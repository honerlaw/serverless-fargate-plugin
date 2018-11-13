import {IServiceOptions, IServiceProtocolOptions} from "../options";
import {Cluster} from "./cluster";
import {NamePostFix, Resource} from "../resource";
import {Protocol} from "./protocol";

export class Service extends Resource<IServiceOptions> {

    private static readonly EXECUTION_ROLE_NAME: string = "ECSServiceExecutionRole";

    private readonly cluster: Cluster;
    private readonly protocols: Protocol[];

    public constructor(cluster: Cluster, options: IServiceOptions) {
        // camelcase a default name
        super(options, options.name
            .toLowerCase() // lowercase everything
            .replace(/[^A-Za-z0-9]/g, ' ') // replace non alphanumeric with soaces
            .split(' ') // split on those spaces
            .filter((piece: string): boolean => piece.trim().length > 0) // make sure we only accept 1 char or more
            .map((piece: string): string => piece.charAt(0).toUpperCase() + piece.substring(1)) // capitalize each piece
            .join('')); // join back to a single strimg
        this.cluster = cluster;

        this.protocols = this.options.protocols.map((protocol: IServiceProtocolOptions): any => {
            return new Protocol(cluster, this, protocol);
        });
    }

    public getTargetGroupNames(): string[] {
        return this.options.protocols
            .map((protocol: IServiceProtocolOptions): string => `${protocol.protocol}${this.getName(NamePostFix.TARGET_GROUP)}`);
    }

    public generate(): any {
        const executionRole: any | undefined = this.cluster.getExecutionRoleArn() ? undefined : this.generateExecutionRole();

        return Object.assign(
            {},
            this.generateService(),
            this.generateTaskDefinition(),
            ...this.protocols.map((protocol: Protocol): any => protocol.generate()),
            executionRole // could be undefined, so set it last
        );
    }

    private generateService(): object {
        return {
            [this.getName(NamePostFix.SERVICE)]: {
                "Type": "AWS::ECS::Service",
                "DependsOn": this.getName(NamePostFix.LOAD_BALANCER_LISTENER_RULE),
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
                    "LoadBalancers": this.getTargetGroupNames().map((targetGroupName: string): any => ({
                        "ContainerName": this.options.name,
                        "ContainerPort": this.options.port,
                        "TargetGroupArn": {
                            "Ref": targetGroupName
                        }
                    }))
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
                        {
                            "Name": this.options.name,
                            "Cpu": this.options.cpu,
                            "Memory": this.options.memory,
                            "Image": `${this.options.imageRepository}:${this.options.name}-${this.options.imageTag}`,
                            "EntryPoint": this.options.entryPoint,
                            "PortMappings": [
                                {
                                    "ContainerPort": this.options.port
                                }
                            ]
                        }
                    ]
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