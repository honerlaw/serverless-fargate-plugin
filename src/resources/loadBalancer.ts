import { IClusterOptions, IServiceOptions} from "../options";
import {VPC} from "./vpc";
import {Service} from "./service";
import {NamePostFix, Resource} from "../resource";
import {Cluster} from './cluster';
import { Protocol } from "./protocol";

export class LoadBalancer extends Resource<IClusterOptions> {

    private readonly cluster: Cluster;

    public constructor(stage: string, options: IClusterOptions, cluster: Cluster, tags?: object) {
        super(options, stage, cluster.getNamePrefix(), tags);
        this.cluster = cluster;
    }

    public getOutputs(): any { return {}; }

    public generate(): any {
        return Object.assign({
            ...(this.options.disableELB ? {} : {
                ...(this.options.elbListenerArn ? {} : {
                    [this.getName(NamePostFix.LOAD_BALANCER)]: {
                        "Type": "AWS::ElasticLoadBalancingV2::LoadBalancer",
                        "DeletionPolicy": "Delete",
                        "Properties": {
                            "Name": this.getName(NamePostFix.LOAD_BALANCER),
                            ...(this.getTags() ? { "Tags": this.getTags() } : {}),
                            "Scheme": (this.cluster.isPublic() ? "internet-facing" : "internal"),
                            "LoadBalancerAttributes": [
                                {
                                    "Key": "idle_timeout.timeout_seconds",
                                    "Value": (this.options.timeout || 30)
                                }
                            ],
                            "Subnets": this.cluster.getVPC().getSubnets(),
                            "SecurityGroups": this.getELBSecurityGroupsRef()
                        },
                    },
                    ...this.getListeners()
                }),
                ...this.getServicesSecurityGroups(),
            }),
        });
    }


    /* Security groups */
    private getELBSecurityGroupsRef(): any {;
        let secGroups = [];
        this.cluster.services.forEach((service: Service) => {
            if (this.options.public && !service.getOptions().disableELB) {
                secGroups.push({ "Ref": this.getSecurityGroupNameByService(service) });
            }
        });
        //Check if need to append specified SGs
        if (this.cluster.getVPC().useExistingVPC()) {
            if (Array.isArray(this.cluster.getVPC().getSecurityGroups())) secGroups = secGroups.concat(this.cluster.getVPC().getSecurityGroups());
            else if (this.cluster.getVPC().getSecurityGroups()['Fn::Split']) { //handle case where split is specified but we need to make the split operation before concating
                const split = this.cluster.getVPC().getSecurityGroups()['Fn::Split'];
                const parts = split[1].split(split[0]);
                secGroups = secGroups.concat(parts);
            } else secGroups.push(this.cluster.getVPC().getSecurityGroups());
        }  return secGroups;
    }

    private getSecurityGroupNameByService(service: Service): string {
        return `${this.getName(NamePostFix.LOAD_BALANCER_SECURITY_GROUP)}${service.getOptions().name}`;
    }
    
    private getServicesSecurityGroups(): object {
        let secGroups = {};
        this.cluster.services.forEach( (service: Service) => {
            secGroups = {
                ...secGroups,
                ...this.generateSecurityGroupsByService(service)
            };
        });
        return secGroups;
    }

    private generateSecurityGroupsByService(service: Service): any {
        const ELBServiceSecGroup = this.getSecurityGroupNameByService(service);
        return {
            //Public security groups
            ...(this.options.public && !service.getOptions().disableELB ? {
                [ELBServiceSecGroup]: {
                    "Type": "AWS::EC2::SecurityGroup",
                    "DeletionPolicy": "Delete",
                    "Properties": {
                        ...(this.getTags() ? { "Tags": this.getTags() } : {}),
                        "GroupDescription": `Access to the public facing load balancer - task ${service.getName(NamePostFix.SERVICE)}`,
                        "VpcId": this.cluster.getVPC().getRefName(),
                        "SecurityGroupIngress": [
                            {
                                "CidrIp": "0.0.0.0/0",
                                //Todo: Can we improve security here?
                                // ...(service.port ? {
                                //     "IpProtocol": 'tcp',
                                //     "toPort": service.port,
                                //     "fromPort": service.port
                                // } : { })
                                "IpProtocol": -1
                            }
                        ]
                    }
                },
                ...(!this.cluster.getVPC().useExistingVPC() &&
                    {
                        [ELBServiceSecGroup + NamePostFix.SECURITY_GROUP_INGRESS_ALB]: {
                            "Type": "AWS::EC2::SecurityGroupIngress",
                            "DeletionPolicy": "Delete",
                            "Properties": {
                                "Description": `Ingress from the ALB - task ${service.getName(NamePostFix.SERVICE)}`,
                                "GroupId": this.cluster.getClusterIngressSecGroup(),
                                "IpProtocol": -1,
                                "SourceSecurityGroupId": {
                                    "Ref": ELBServiceSecGroup
                                }
                            }
                        }
                    }
                )
            } : {
                /*TODO: if not public AND also not specifiying a VPC, different secgroup must be created*/
            })
        }
    }

    /* Elastic Load Balance -- this should be moved to ELB class when implemented */
    private getListeners(): any {
        const aggServices = this.getAggregatedServices();
        let listeners = {};
        Object.keys(aggServices).forEach( (listenerKey) => {
            const listener = aggServices[listenerKey];
            const defaultService = listener.services[0];
            listeners = {
                ...listeners,
                [this.getName(NamePostFix.LOAD_BALANCER_LISTENER)+listener.proto.port]: {
                    "Type": "AWS::ElasticLoadBalancingV2::Listener",
                    "DeletionPolicy": "Delete",
                    "DependsOn": [
                        this.getName(NamePostFix.LOAD_BALANCER)
                    ],
                    "Properties": {
                        "DefaultActions": [{ //Note: this is just the default, no biggie
                            "TargetGroupArn": {
                                "Ref": defaultService.getName(NamePostFix.TARGET_GROUP)
                            },
                            "Type": "forward"
                        }],
                        "LoadBalancerArn": {
                            "Ref": this.getName(NamePostFix.LOAD_BALANCER)
                        },
                        "Port": listener.proto.port,
                        "Protocol": listener.proto.getOptions().protocol,
                        ...(listener.proto.getOptions().protocol == "HTTPS" ? {
                            "Certificates": listener.proto.getOptions().certificateArns.map((certificateArn: string): any => ({
                                "CertificateArn": certificateArn
                            }))} : {}
                        )
                    }
                }
            };
        });
        return listeners;
    }
    private getAggregatedServices(): any {
        //Sanity check -- check if have more than one service listening for the same port, but different protocol
        //This is not allowed, better to explicty deny it rather than creating confusion os misconfigured systems
        let mappings = {};
        for (let service of this.cluster.services) {
            for (let proto of service.protocols) {
                if (mappings[proto.port]) {
                    if (mappings[proto.port].proto.getOptions().protocol != proto.getOptions().protocol) {
                        throw new Error(`Serverless: fargate-plugin: Service ${service.getOptions().name} on cluster ${this.cluster.getName(NamePostFix.CLUSTER)}, protocol ${proto.getOptions().protocol} is colliding with different service at same cluster on port ${proto.port}. Can't continue!`);
                    }
                    mappings[proto.port].services.push(service);
                    //TODO: create error if using shared ecs, ports should be dynamically found
                } else mappings[proto.port] = { proto, services: [service]};
            }
        }
        return mappings;
    }
}
