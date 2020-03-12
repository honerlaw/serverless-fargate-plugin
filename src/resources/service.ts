import {IServiceOptions, IServiceProtocolOptions} from "../options";
import {Cluster} from "./cluster";
import {NamePostFix, Resource} from "../resource";
import {Protocol} from "./protocol";
import * as uuid from 'uuid/v1';

export class Service extends Resource<IServiceOptions> {

    private static readonly EXECUTION_ROLE_NAME: string = "ECSServiceExecutionRole";
    private readonly logGroupName: string;
    public readonly port: number;
    private readonly cluster: Cluster;
    private readonly protocols: Protocol[];

    public constructor(stage: string, options: IServiceOptions, cluster: Cluster, tags?: object) {
        // camelcase a default name
        const safeResourceName = options.name
            .toLowerCase() // lowercase everything
            .replace(/[^A-Za-z0-9]/g, ' ') // replace non alphanumeric with soaces
            .split(' ') // split on those spaces
            .filter((piece: string): boolean => piece.trim().length > 0) // make sure we only accept 1 char or more
            .map((piece: string): string => piece.charAt(0).toUpperCase() + piece.substring(1)) // capitalize each piece
            .join('');// join back to a single string
        //
        super(options, stage, safeResourceName, tags); 
        this.cluster = cluster;
        this.protocols = (this.cluster.getOptions().disableELB ? [] : this.options.protocols.map((serviceProtocolOptions: IServiceProtocolOptions): any => {
            return new Protocol(cluster, this, stage, serviceProtocolOptions, tags);
        }));

        this.logGroupName = `serverless-fargate-${options.name}-${stage}-${uuid()}`;

        this.port = (this.options.port || (Math.floor(Math.random() * 49151) + 1024))
        console.debug(`Serverless: fargate-plugin: Using port ${this.port} for service ${options.name} on cluster ${cluster.getName(NamePostFix.CLUSTER)}`);
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
            this.generateAutoscaling(),
            executionRole // could be undefined, so set it last
        );
    }

    public getOutputs(): any {
        let outputs = {};
        this.protocols.forEach((protocol: Protocol) => {
            outputs = {
                ...outputs,
                ...protocol.getOutputs()
            }
        }); 
        return outputs;
    }

    private generateService(): object {
        return {
            [this.getName(NamePostFix.SERVICE)]: {
                "Type": "AWS::ECS::Service",
                "DeletionPolicy": "Delete",
                ...(this.cluster.getOptions().disableELB ? {} : {
                    "DependsOn": this.protocols.map((protocol: Protocol): string => {
                        return protocol.getName(NamePostFix.LOAD_BALANCER_LISTENER_RULE)
                    }),
                }),
                "Properties": {
                    "ServiceName": this.options.name,
                    "Cluster": {
                        "Ref": this.cluster.getName(NamePostFix.CLUSTER)
                    },
                    ...(this.getTags() ? { "Tags": this.getTags() } : {}),
                    "LaunchType": "FARGATE",
                    "DeploymentConfiguration": {
                        "MaximumPercent": 200,
                        "MinimumHealthyPercent": 75
                    },
                    "DesiredCount": this.options.desiredCount ? this.options.desiredCount : 1,
                    "NetworkConfiguration": {
                        "AwsvpcConfiguration": {
                            "AssignPublicIp": (this.cluster.isPublic() ? "ENABLED" : "DISABLED"),
                            "SecurityGroups": this.getSecurityGroups(),
                            "Subnets": this.cluster.getVPC().getSubnets()
                        }
                    },
                    "TaskDefinition": {
                        "Ref": this.getName(NamePostFix.TASK_DEFINITION)
                    },
                    ...(this.cluster.getOptions().disableELB ? {} : {
                        "LoadBalancers": [
                            {
                                "ContainerName": this.getName(NamePostFix.CONTAINER_NAME),
                                "ContainerPort": this.port,
                                "TargetGroupArn": {
                                    "Ref": this.getName(NamePostFix.TARGET_GROUP)
                                }
                            }
                        ]
                    })
                }
            },
        };
    }

    private generateTaskDefinition(): object {
        return {
            [this.getName(NamePostFix.TASK_DEFINITION)]: {
                "Type": "AWS::ECS::TaskDefinition",
                "DeletionPolicy": "Delete",
                "Properties": {
                    ...(this.getTags() ? { "Tags": this.getTags() } : {}),
                    "Family": `${this.options.name}-${this.stage}`,
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
                            ...(this.options.entryPoint ? { "EntryPoint": this.options.entryPoint } : {}),
                            "PortMappings": [
                                {
                                    "ContainerPort": this.port
                                }
                            ],
                            "LogConfiguration": {
                                "LogDriver": "awslogs",
                                "Options": {
                                    "awslogs-group": this.logGroupName,
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
        if (this.cluster.getOptions().disableELB) return {};
        return {
            [this.getName(NamePostFix.TARGET_GROUP)]: {
                "Type": "AWS::ElasticLoadBalancingV2::TargetGroup",
                "DeletionPolicy": "Delete",
                "Properties": {
                    ...(this.getTags() ? { "Tags": this.getTags() } : {}),
                    "HealthCheckIntervalSeconds": this.options.healthCheckInterval ? this.options.healthCheckInterval : 6,
                    "HealthCheckPath": this.options.healthCheckUri ? this.options.healthCheckUri : "/",
                    "HealthCheckProtocol": this.options.healthCheckProtocol ? this.options.healthCheckProtocol : "HTTP",
                    "HealthCheckTimeoutSeconds": 5,
                    "HealthyThresholdCount": 2,
                    "TargetType": "ip",
                    "Name": this.getName(NamePostFix.TARGET_GROUP),
                    "Port": this.port,
                    "Protocol": "HTTP",
                    "UnhealthyThresholdCount": 2,
                    "VpcId": this.cluster.getVPC().getRefName()
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
                "DeletionPolicy": "Delete",
                "Properties": {
                    ...(this.getTags() ? { "Tags": this.getTags() } : {}),
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
                "DeletionPolicy": "Delete",
                "Properties": {
                    "LogGroupName": this.logGroupName,
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

    private getSecurityGroups(): any {
        if (this.cluster.getVPC().useExistingVPC()) {
            return this.cluster.getVPC().getSecurityGroups();  
        } return [{ "Ref": this.cluster.getName(NamePostFix.CONTAINER_SECURITY_GROUP) }];
    }

    /* Auto scaling service -- this also could be moved to another class */

    private generateAutoscaling() {
        if (!this.options.autoScale) return {};
        //Generate auto scaling for this service
        return {
            [this.getName(NamePostFix.AutoScalingRole)]: {
                "Type": "AWS::IAM::Role",
                "DeletionPolicy": "Delete",
                "Properties": {
                    ...(this.getTags() ? { "Tags": this.getTags() } : {}),
                    "RoleName": this.getName(NamePostFix.AutoScalingRole),
                    "AssumeRolePolicyDocument": {
                        "Statement": [
                            {
                                "Effect": "Allow",
                                "Action": "sts:AssumeRole",
                                "Principal": {
                                    "Service": "ecs-tasks.amazonaws.com",
                                }
                            }
                        ]
                    },
                    "ManagedPolicyArns": [
                        "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceAutoscaleRole"
                    ]
                }
            },
            [this.getName(NamePostFix.AutoScalingTarget)]: {
                "Type": "AWS::ApplicationAutoScaling::ScalableTarget",
                "DeletionPolicy": "Delete",
                "Properties": {
                    "MinCapacity": this.options.autoScale.min || 1,
                    "MaxCapacity": this.options.autoScale.max || 1,
                    "ScalableDimension": "ecs:service:DesiredCount",
                    "ServiceNamespace": "ecs",
                    "ResourceId": {
                        "Fn::Join": [
                            "/",
                            [
                                "service", 
                                { "Ref": this.cluster.getName(NamePostFix.CLUSTER) },
                                { "Fn::GetAtt": [ this.getName(NamePostFix.SERVICE), "Name" ] }
                            ]
                        ]
                    },
                    "RoleARN": {
                        "Fn::GetAtt": [
                            this.getName(NamePostFix.AutoScalingRole), "Arn"
                        ]
                    }
                }
            },
            [this.getName(NamePostFix.AutoScalingPolicy)]: {
                "Type": "AWS::ApplicationAutoScaling::ScalingPolicy",
                "DeletionPolicy": "Delete",
                "Properties": {
                    "PolicyName": this.getName(NamePostFix.AutoScalingPolicy),
                    "PolicyType": "TargetTrackingScaling",
                    "ScalingTargetId": {
                        "Ref": this.getName(NamePostFix.AutoScalingTarget)
                    },
                    "TargetTrackingScalingPolicyConfiguration": {
                        "ScaleInCooldown": this.options.autoScale.cooldownIn || this.options.autoScale.cooldown || 30,
                        "ScaleOutCooldown": this.options.autoScale.cooldownOut || this.options.autoScale.cooldown || 30,
                        "TargetValue": this.options.autoScale.targetValue,
                        "PredefinedMetricSpecification": {
                            "PredefinedMetricType": this.options.autoScale.metric,
                        }
                    }
                }
            }
        }
    }

}
