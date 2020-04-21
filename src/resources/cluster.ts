import { IClusterOptions, IServiceOptions} from "../options";
import {VPC} from "./vpc";
import {Service} from "./service";
import {LoadBalancer} from './loadBalancer';
import {NamePostFix, Resource} from "../resource";
import { Protocol } from "./protocol";

export class Cluster extends Resource<IClusterOptions> {

    private readonly vpc: VPC;
    public readonly services: Service[];
    public readonly loadBalancer: LoadBalancer;
    private readonly serviceName: string;

    public constructor(stage: string, options: IClusterOptions, vpc: VPC, serviceName: string, tags?: object) {
        super(options, stage, `${serviceName}${options.clusterName}`, tags);
        this.vpc = vpc;
        this.serviceName = serviceName;
        this.services = this.options.services.map((serviceOptions: IServiceOptions): any => {
            return new Service(this.stage, serviceOptions, this, tags);
        });
        this.loadBalancer = new LoadBalancer(stage, options, this, tags);
    }

    public getExecutionRoleArn(): string | undefined {
        return this.options.executionRoleArn;
    }

    public getOutputs(): any {
        let outputs = {
            ...this.loadBalancer.getOutputs()
        };
        this.services.forEach((service: Service) => {
            outputs = {
                ...outputs,
                ...service.getOutputs()
            }
        });
        return outputs;
    }

    public getVPC(): VPC {
        return this.vpc;
    }

    public isPublic(): boolean {
        return this.options.public;
    }

    public generate(): any {

        // generate the defs for each service
        const defs: any[] = this.services.map((service: Service): any => service.generate());

        return Object.assign({
            [this.getName(NamePostFix.CLUSTER)]: {
                "Type": "AWS::ECS::Cluster",
                "DeletionPolicy": "Delete",
                "Properties": {
                    "ClusterName": this.getName(NamePostFix.CLUSTER),
                    ...(this.getTags() ? { "Tags": this.getTags() } : {}),
                }
            },
            ...this.getClusterSecurityGroups(),
            ...this.loadBalancer.generate(),
        }, ...defs);
    }

    public getServiceListenerPriority(service: Service, protocol: Protocol): number {
        //Get ordered services
        const oServices = this.services.sort( (a,b) => {
            if (!a.getOptions().priority && !b.getOptions().priority) return 0; //dec order
            if (!a.getOptions().priority) return 1;
            if (!b.getOptions().priority) return -1;
            return a.getOptions().priority - b.getOptions().priority;
        });
        let p = 1; //starts at 1 by AWS def
        for (let service of oServices) {
            if (service == service) {
                return p + (service.protocols.indexOf(protocol) + 1);
            } else p += service.protocols.length; //increase by proto count
        } return -1; //not found
    }

    private getClusterSecurityGroups(): any {
        if (this.getVPC().useExistingVPC()) { return {}; } //No security group resource is required
        else {
            return {
                [this.getName(NamePostFix.CONTAINER_SECURITY_GROUP)]: {
                    "Type": "AWS::EC2::SecurityGroup",
                    "DeletionPolicy": "Delete",
                    "Properties": {
                        ...(this.getTags() ? { "Tags": this.getTags() } : {}),
                        "GroupDescription": "Access to the Fargate containers",
                        "VpcId": this.getVPC().getRefName()
                    }
                },
                [this.getName(NamePostFix.SECURITY_GROUP_INGRESS_SELF)]: {
                    "Type": "AWS::EC2::SecurityGroupIngress",
                    "DeletionPolicy": "Delete",
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
                }
            };
        }
    }
}
