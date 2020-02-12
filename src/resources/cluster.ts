import {IPluginOptions, IServiceOptions} from "../options";
import {VPC} from "./vpc";
import {Service} from "./service";
import {NamePostFix, Resource} from "../resource";

export class Cluster extends Resource<IPluginOptions> {

    private readonly vpc: VPC;

    public constructor(stage: string, options: IPluginOptions, vpc: VPC) {
        super(options, stage, 'ECS');
        this.vpc = vpc;
    }

    public getExecutionRoleArn(): string | undefined {
        return this.options.executionRoleArn;
    }

    public getVPC(): VPC {
        return this.vpc;
    }

    public generate(): any {

        // generate the defs for each service
        const defs: any[] = this.options.services.map((serviceOptions: IServiceOptions): any => {
            return new Service(this.stage, serviceOptions, this).generate();
        });

        return Object.assign({
            [this.getName(NamePostFix.CLUSTER)]: {
                "Type": "AWS::ECS::Cluster"
            },
            [this.getName(NamePostFix.CONTAINER_SECURITY_GROUP)]: {
                "Type": "AWS::EC2::SecurityGroup",
                "Properties": {
                    "GroupDescription": "Access to the Fargate containers",
                    "VpcId": this.getVPC().getRefName()
                }
            },
            [this.getName(NamePostFix.SECURITY_GROUP_INGRESS_ALB)]: {
                "Type": "AWS::EC2::SecurityGroupIngress",
                "Properties": {
                    "Description": "Ingress from the public ALB",
                    "GroupId": {
                        "Ref": this.getName(NamePostFix.CONTAINER_SECURITY_GROUP)
                    },
                    "IpProtocol": -1,
                    "SourceSecurityGroupId": {
                        "Ref": this.getName(NamePostFix.LOAD_BALANCER_SECURITY_GROUP)
                    }
                }
            },
            [this.getName(NamePostFix.SECURITY_GROUP_INGRESS_SELF)]: {
                "Type": "AWS::EC2::SecurityGroupIngress",
                "Properties": {
                    "Description": "Ingress from other containers in the same security group",
                    "GroupId": {
                        "Ref": this.getName(NamePostFix.CONTAINER_SECURITY_GROUP)
                    },
                    "IpProtocol": -1,
                    "SourceSecurityGroupId": {
                        "Ref": this.getName(NamePostFix.CONTAINER_SECURITY_GROUP)
                    }
                }
            },
            [this.getName(NamePostFix.LOAD_BALANCER_SECURITY_GROUP)]: {
                "Type": "AWS::EC2::SecurityGroup",
                "Properties": {
                    "GroupDescription": "Access to the public facing load balancer",
                    "VpcId": this.getVPC().getRefName(),
                    "SecurityGroupIngress": [
                        {
                            "CidrIp": "0.0.0.0/0",
                            "IpProtocol": -1
                        }
                    ]
                }
            },
            [this.getName(NamePostFix.LOAD_BALANCER)]: {
                "Type": "AWS::ElasticLoadBalancingV2::LoadBalancer",
                "Properties": {
                    "Scheme": "internet-facing",
                    "LoadBalancerAttributes": [
                        {
                            "Key": "idle_timeout.timeout_seconds",
                            "Value": "30"
                        }
                    ],
                    "Subnets": this.getVPC().getSubnets(),
                    "SecurityGroups": [
                        {
                            "Ref": this.getName(NamePostFix.LOAD_BALANCER_SECURITY_GROUP)
                        }
                    ]
                }
            },
        }, ...defs);
    }

}
