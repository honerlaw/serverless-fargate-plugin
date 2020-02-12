import {IPluginOptions, IServiceOptions} from "../options";
import {VPC} from "./vpc";
import {Service} from "./service";
import {NamePostFix, Resource} from "../resource";

export class Cluster extends Resource<IPluginOptions> {

    private readonly vpc: VPC;
    private readonly services: Service[];

    public constructor(stage: string, options: IPluginOptions, vpc: VPC) {
        super(options, stage, 'ECS');
        this.vpc = vpc;
        this.services = this.options.services.map((serviceOptions: IServiceOptions): any => {
            return new Service(this.stage, serviceOptions, this);
        });
    }

    public getExecutionRoleArn(): string | undefined {
        return this.options.executionRoleArn;
    }

    public getVPC(): VPC {
        return this.vpc;
    }

    public generate(): any {

        // generate the defs for each service
        const defs: any[] = this.services.map((service: Service): any => {
            service.generate();
        });

        return Object.assign({
            [this.getName(NamePostFix.CLUSTER)]: {
                "Type": "AWS::ECS::Cluster"
            },
            ...this.getSecurityGroups(),
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
                    "SecurityGroups": this.getELBSecurityGroups()
                }
            },
        }, ...defs);
    }

    private getELBSecurityGroups() {
        if (this.getVPC().useExistingVPC()) {
            return this.getVPC().getSecurityGroups();
        } return [{ "Ref": this.getName(NamePostFix.LOAD_BALANCER_SECURITY_GROUP) }];
    }

    private getSecurityGroups(): any {
        let baseSecurityGroups = [];
        if (this.getVPC().useExistingVPC()) baseSecurityGroups = this.getVPC().getSecurityGroups();
        return {
            ...baseSecurityGroups,
            [this.getName(NamePostFix.CONTAINER_SECURITY_GROUP)]: {
                "Type": "AWS::EC2::SecurityGroup",
                "Properties": {
                    "GroupDescription": "Access to the Fargate containers",
                    "VpcId": this.getVPC().getRefName()
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
            ...this.generateServicesSecurityGroups()
        };
    }
    
    private generateServicesSecurityGroups(): object {
        let secGroups = {};
        this.services.forEach( (service: Service) => {
            secGroups = {
                ...secGroups,
                ...this.generateSecurityGroupsByService(service)
            };
        });
        return secGroups;

    }

    private generateSecurityGroupsByService(service: Service): any {
        const ELBServiceSecGroup = `${this.getName(NamePostFix.LOAD_BALANCER_SECURITY_GROUP)}_${service.getName(NamePostFix.SERVICE)}`;
        return {
            [this.getName(NamePostFix.SECURITY_GROUP_INGRESS_ALB)]: {
                "Type": "AWS::EC2::SecurityGroupIngress",
                "Properties": {
                    "Description": `Ingress from the ALB - task ${service.getName(NamePostFix.SERVICE)}`,
                    "GroupId": {
                        "Ref": this.getName(NamePostFix.CONTAINER_SECURITY_GROUP)
                    },
                    "IpProtocol": -1,
                    "SourceSecurityGroupId": {
                        "Ref": ELBServiceSecGroup
                    }
                }
            },
            //Public security group
            ...(this.options.public ? {
                [ELBServiceSecGroup]: {
                    "Type": "AWS::EC2::SecurityGroup",
                    "Properties": {
                        "GroupDescription": `Access to the public facing load balancer - task ${service.getName(NamePostFix.SERVICE)}`,
                        "VpcId": this.getVPC().getRefName(),
                        "SecurityGroupIngress": [
                            {
                                "CidrIp": "0.0.0.0/0",
                                "IpProtocol": -1,
                                "toPort": service.port
                            }
                        ]
                    }
                }
            } : {})
        }
    }
}
