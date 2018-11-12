import {IResourceGenerator, IServiceOptions} from "./definitions";
import {Cluster} from "./cluster";

export class Service implements IResourceGenerator {

    private static readonly EXECUTION_ROLE_NAME: string = "ECSServiceExecutionRole";

    private readonly cluster: Cluster;
    private readonly options: IServiceOptions;

    public constructor(cluster: Cluster, options: IServiceOptions) {
        this.cluster = cluster;
        this.options = options;
    }

    public generate(): any {
        const executionRole: any | undefined = this.cluster.getExecutionRoleArn() ? undefined : this.generateExecutionRole();

        return Object.assign(
            {},
            this.generateService(),
            this.generateTaskDefinition(),
            this.generateTargetGroup(),
            this.generateLoadBalancerRule(),
            executionRole // could be undefined, so set it last
        );
    }

    private generateService(): object {
        return {
            "Service": {
                "Type": "AWS::ECS::Service",
                "DependsOn": "LoadBalancerRule",
                "Properties": {
                    "ServiceName": this.options.name,
                    "Cluster": {
                        "Ref": this.cluster.getClusterName()
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
                                    "Ref": "FargateContainerSecurityGroup"
                                }
                            ],
                            "Subnets": this.cluster.getVPC().getSubnetNames().map((subnetName: string): any => ({
                                "Ref": subnetName
                            }))

                        }
                    },
                    "TaskDefinition": {
                        "Ref": "TaskDefinition"
                    },
                    "LoadBalancers": [
                        {
                            "ContainerName": this.options.name,
                            "ContainerPort": this.options.port,
                            "TargetGroupArn": {
                                "Ref": "TargetGroup"
                            }
                        }
                    ]
                }
            },
        };
    }

    private generateTaskDefinition(): object {
        return {
            "TaskDefinition": {
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
                            "Image": `${this.options.imageRepository || this.cluster.getImageRepository()}/${this.options.name}:${this.options.imageTag}`,
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

    private generateTargetGroup(): any {
        return {
            "TargetGroup": {
                "Type": "AWS::ElasticLoadBalancingV2::TargetGroup",
                "Properties": {
                    "HealthCheckIntervalSeconds": 6,
                    "HealthCheckPath": "/",
                    "HealthCheckProtocol": "HTTP",
                    "HealthCheckTimeoutSeconds": 5,
                    "HealthyThresholdCount": 2,
                    "TargetType": "ip",
                    "Name": this.options.name,
                    "Port": this.options.port,
                    "Protocol": "HTTP",
                    "UnhealthyThresholdCount": 2,
                    "VpcId": {
                        "Ref": "VPC"
                    }
                }
            }
        };
    }

    private generateLoadBalancerRule(): any {
        return {
            "LoadBalancerRule": {
                "Type": "AWS::ElasticLoadBalancingV2::ListenerRule",
                "Properties": {
                    "Actions": [
                        {
                            "TargetGroupArn": {
                                "Ref": "TargetGroup"
                            },
                            "Type": "forward"
                        }
                    ],
                    "Conditions": [
                        {
                            "Field": "path-pattern",
                            "Values": [this.options.path ? this.options.path : '*']
                        }
                    ],
                    "ListenerArn": {
                        "Ref": "PublicLoadBalancerListener"
                    },
                    "Priority": this.options.priority ? this.options.priority : 1
                }
            }
        };
    }

    private generateExecutionRole(): any {
        const def: any = {};
        def[Service.EXECUTION_ROLE_NAME] = {
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
        };
        return def;
    }

    private getExecutionRoleValue(): string | object {
        const executionRoleArn: string | undefined = this.cluster.getExecutionRoleArn();
        if (!executionRoleArn) {
            return executionRoleArn;
        }
        return {
            "Ref": Service.EXECUTION_ROLE_NAME
        };
    }

}