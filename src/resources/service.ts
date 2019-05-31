import {IServiceOptions, IServiceProtocolOptions} from "../options";
import {Cluster} from "./cluster";
import {NamePostFix, Resource} from "../resource";
import {Protocol} from "./protocol";

export class Service extends Resource<IServiceOptions> {

    private static readonly EXECUTION_ROLE_NAME: string = "ECSServiceExecutionRole";

    private readonly cluster: Cluster;
    private readonly protocols: Protocol[];

    public constructor(stage: string, options: IServiceOptions, cluster: Cluster) {
        // camelcase a default name
        super(options, stage, options.name
            .toLowerCase() // lowercase everything
            .replace(/[^A-Za-z0-9]/g, ' ') // replace non alphanumeric with soaces
            .split(' ') // split on those spaces
            .filter((piece: string): boolean => piece.trim().length > 0) // make sure we only accept 1 char or more
            .map((piece: string): string => piece.charAt(0).toUpperCase() + piece.substring(1)) // capitalize each piece
            .join('')); // join back to a single strimg
        this.cluster = cluster;

        this.protocols = this.options.protocols.map((serviceProtocolOptions: IServiceProtocolOptions): any => {
            return new Protocol(cluster, this, stage, serviceProtocolOptions);
        });
    }

    public generate(): any {
        const executionRole: any | undefined = this.cluster.getExecutionRoleArn() ? undefined : this.generateExecutionRole();

        return Object.assign(
            {},
            this.generateService(),
            this.generateTaskDefinition(),
            this.generateTargetGroup(),
            this.generateLogGroup(),
            ...this.protocols.map((protocol: Protocol): any => protocol.generate()),
            executionRole // could be undefined, so set it last
        );
    }

    private generateService(): object {
        return {
            [this.getName(NamePostFix.SERVICE)]: {
                "Type": "AWS::ECS::Service",
                "DependsOn": this.protocols.map((protocol: Protocol): string => {
                    return protocol.getName(NamePostFix.LOAD_BALANCER_LISTENER_RULE)
                }),
                "Properties": {
                    "ServiceName": this.options.name,
                    "Cluster": {
                        "Ref": this.cluster.getName(NamePostFix.CLUSTER)
                    },
                    "LaunchType": "FARGATE",
                    "DeploymentConfiguration": {
                        "MaximumPercent": 200,
                        "MinimumHealthyPercent": 75
                    },
                    "DesiredCount": this.options.desiredCount ? this.options.desiredCount : 1,
                    "NetworkConfiguration": {
                        "AwsvpcConfiguration": {
                            "AssignPublicIp": "ENABLED",
                            "SecurityGroups": [
                                {
                                    "Ref": this.cluster.getName(NamePostFix.CONTAINER_SECURITY_GROUP)
                                }
                            ],
                            "Subnets": this.cluster.getVPC().getSubnetNames().map((subnetName: string): any => ({
                                "Ref": subnetName
                            }))

                        }
                    },
                    "TaskDefinition": {
                        "Ref": this.getName(NamePostFix.TASK_DEFINITION)
                    },
                    "LoadBalancers": [
                        {
                            "ContainerName": this.getName(NamePostFix.CONTAINER_NAME),
                            "ContainerPort": this.options.port,
                            "TargetGroupArn": {
                                "Ref": this.getName(NamePostFix.TARGET_GROUP)
                            }
                        }
                    ]
                }
            },
        };
    }

    private generateTaskDefinition(): object {
        return {
            [this.getName(NamePostFix.TASK_DEFINITION)]: {
                "Type": "AWS::ECS::TaskDefinition",
                "Properties": {
                    "Family": this.options.name,
                    "Cpu": this.options.cpu,
                    "Memory": this.options.memory,
                    "NetworkMode": "awsvpc",
                    "RequiresCompatibilities": [
                        "FARGATE"
                    ],
                    "ExecutionRoleArn": this.getExecutionRoleValue(),
                    "TaskRoleArn": this.options.taskRoleArn ? this.options.taskRoleArn : ({
                        "Ref": "AWS::NoValue"
                    }),
                    "ContainerDefinitions": [
                        Object.assign({
                            "Name": this.getName(NamePostFix.CONTAINER_NAME),
                            "Cpu": this.options.cpu,
                            "Memory": this.options.memory,
                            "Image": this.options.image || `${this.options.imageRepository}:${this.options.name}-${this.options.imageTag}`,
                            "EntryPoint": this.options.entryPoint,
                            "PortMappings": [
                                {
                                    "ContainerPort": this.options.port
                                }
                            ],
                            "LogConfiguration": {
                                "LogDriver": "awslogs",
                                "Options": {
                                    "awslogs-group": `serverless-fargate-${this.stage}`,
                                    "awslogs-region": {
                                        "Ref": "AWS::Region"
                                    },
                                    "awslogs-stream-prefix": this.options.name
                                }
                            }
                        },
                        this.options.environment && {
                            "Environment": Object.keys(this.options.environment).map(name => ({
                                "Name": name,
                                "Value": String(this.options.environment[name]),
                            }))
                        })
                    ]
                }
            }
        };
    }

    private generateTargetGroup(): any {
        return {
            [this.getName(NamePostFix.TARGET_GROUP)]: {
                "Type": "AWS::ElasticLoadBalancingV2::TargetGroup",
                "Properties": {
                    "HealthCheckIntervalSeconds": this.options.healthCheckInterval ? this.options.healthCheckInterval : 6,
                    "HealthCheckPath": this.options.healthCheckUri ? this.options.healthCheckUri : "/",
                    "HealthCheckProtocol": this.options.healthCheckProtocol ? this.options.healthCheckProtocol : "HTTP",
                    "HealthCheckTimeoutSeconds": 5,
                    "HealthyThresholdCount": 2,
                    "TargetType": "ip",
                    "Name": this.getName(NamePostFix.TARGET_GROUP),
                    "Port": this.options.port,
                    "Protocol": "HTTP",
                    "UnhealthyThresholdCount": 2,
                    "VpcId": {
                        "Ref": this.cluster.getVPC().getName(NamePostFix.VPC)
                    }
                }
            }
        };
    }

    /**
     * Technically we generate this per service, but because of how everything is merged at the end
     * only one of these is in the final template
     *
     * @todo move to a better place
     */
    private generateExecutionRole(): any {
        return {
            [Service.EXECUTION_ROLE_NAME]: {
                "Type": "AWS::IAM::Role",
                "Properties": {
                    "AssumeRolePolicyDocument": {
                        "Statement": [
                            {
                                "Effect": "Allow",
                                "Principal": {
                                    "Service": [
                                        "ecs-tasks.amazonaws.com"
                                    ]
                                },
                                "Action": [
                                    "sts:AssumeRole"
                                ]
                            }
                        ]
                    },
                    "Path": "/",
                    "Policies": [
                        {
                            "PolicyName": "AmazonECSTaskExecutionRolePolicy",
                            "PolicyDocument": {
                                "Statement": [
                                    {
                                        "Effect": "Allow",
                                        "Action": [
                                            "ecr:GetAuthorizationToken",
                                            "ecr:BatchCheckLayerAvailability",
                                            "ecr:GetDownloadUrlForLayer",
                                            "ecr:BatchGetImage",
                                            "logs:CreateLogStream",
                                            "logs:PutLogEvents"
                                        ],
                                        "Resource": "*"
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
        };
    }

    private generateLogGroup(): any {
        return {
            [this.getName(NamePostFix.LOG_GROUP)]: {
                "Type": "AWS::Logs::LogGroup",
                "Properties": {
                    "LogGroupName": `serverless-fargate-${this.stage}`,
                    "RetentionInDays": 30
                }
            }
        };
    }

    private getExecutionRoleValue(): string | object {
        const executionRoleArn: string | undefined = this.cluster.getExecutionRoleArn();
        if (executionRoleArn) {
            return executionRoleArn;
        }
        return {
            "Ref": Service.EXECUTION_ROLE_NAME
        };
    }

}