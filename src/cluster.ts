import {IPluginOptions, IResourceGenerator, IServiceOptions} from "./definitions";
import {VPC} from "./vpc";
import {Service} from "./service";

export class Cluster implements IResourceGenerator {

    private readonly vpc: VPC;
    private readonly options: IPluginOptions;

    public constructor(options: IPluginOptions, vpc: VPC) {
        this.vpc = vpc;
    }

    public getClusterName(): string {
        return "ECSCluster";
    }

    public getImageRepository(): string | undefined {
        return this.options.imageRepository;
    }

    public getExecutionRoleArn(): string | undefined {
        return this.options.executionRoleArn;
    }

    public getVPC(): VPC {
        return this.vpc;
    }

    public generate(): any {

        // generate the defs for each service
        const defs: any[] = this.options.services.map((service: IServiceOptions): any => {
            return new Service(this, service).generate();
        });

        return Object.assign({
            "ECSCluster": {
                "Type": "AWS::ECS::Cluster"
            },
            "FargateContainerSecurityGroup": {
                "Type": "AWS::EC2::SecurityGroup",
                "Properties": {
                    "GroupDescription": "Access to the Fargate containers",
                    "VpcId": {
                        "Ref": "VPC"
                    }
                }
            },
            "EcsSecurityGroupIngressFromPublicALB": {
                "Type": "AWS::EC2::SecurityGroupIngress",
                "Properties": {
                    "Description": "Ingress from the public ALB",
                    "GroupId": {
                        "Ref": "FargateContainerSecurityGroup"
                    },
                    "IpProtocol": -1,
                    "SourceSecurityGroupId": {
                        "Ref": "PublicLoadBalancerSG"
                    }
                }
            },
            "EcsSecurityGroupIngressFromSelf": {
                "Type": "AWS::EC2::SecurityGroupIngress",
                "Properties": {
                    "Description": "Ingress from other containers in the same security group",
                    "GroupId": {
                        "Ref": "FargateContainerSecurityGroup"
                    },
                    "IpProtocol": -1,
                    "SourceSecurityGroupId": {
                        "Ref": "FargateContainerSecurityGroup"
                    }
                }
            },
            "PublicLoadBalancerSG": {
                "Type": "AWS::EC2::SecurityGroup",
                "Properties": {
                    "GroupDescription": "Access to the public facing load balancer",
                    "VpcId": {
                        "Ref": "VPC"
                    },
                    "SecurityGroupIngress": [
                        {
                            "CidrIp": "0.0.0.0/0",
                            "IpProtocol": -1
                        }
                    ]
                }
            },
            "PublicLoadBalancer": {
                "Type": "AWS::ElasticLoadBalancingV2::LoadBalancer",
                "Properties": {
                    "Scheme": "internet-facing",
                    "LoadBalancerAttributes": [
                        {
                            "Key": "idle_timeout.timeout_seconds",
                            "Value": "30"
                        }
                    ],
                    "Subnets": this.vpc.getSubnetNames().map((subnetName: string) => ({
                        "Ref": subnetName
                    })),
                    "SecurityGroups": [
                        {
                            "Ref": "PublicLoadBalancerSG"
                        }
                    ]
                }
            },
            "DummyTargetGroupPublic": {
                "Type": "AWS::ElasticLoadBalancingV2::TargetGroup",
                "Properties": {
                    "HealthCheckIntervalSeconds": 6,
                    "HealthCheckPath": "/",
                    "HealthCheckProtocol": "HTTP",
                    "HealthCheckTimeoutSeconds": 5,
                    "HealthyThresholdCount": 2,
                    "Name": {
                        "Fn::Join": [
                            "-",
                            [
                                {
                                    "Ref": "AWS::StackName"
                                },
                                "drop-1"
                            ]
                        ]
                    },
                    "Port": 80,
                    "Protocol": "HTTP",
                    "UnhealthyThresholdCount": 2,
                    "VpcId": {
                        "Ref": "VPC"
                    }
                }
            },
            "PublicLoadBalancerListener": {
                "Type": "AWS::ElasticLoadBalancingV2::Listener",
                "DependsOn": [
                    "PublicLoadBalancer"
                ],
                "Properties": {
                    "DefaultActions": [
                        {
                            "TargetGroupArn": {
                                "Ref": "DummyTargetGroupPublic"
                            },
                            "Type": "forward"
                        }
                    ],
                    "LoadBalancerArn": {
                        "Ref": "PublicLoadBalancer"
                    },
                    "Port": 80,
                    "Protocol": "HTTP"
                }
            },
        }, ...defs);
    }

}
