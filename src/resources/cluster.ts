import { IClusterOptions, IServiceOptions} from "../options";
import {VPC} from "./vpc";
import {Service} from "./service";
import {LoadBalancer} from './loadBalancer';
import {NamePostFix, Resource} from "../resource";

export class Cluster extends Resource<IClusterOptions> {

    private readonly vpc: VPC;
    public readonly services: Service[];
    public readonly loadBalancer: LoadBalancer;
    public readonly serviceName: string;

    public constructor(stage: string, options: IClusterOptions, vpc: VPC, serviceName: string, tags?: object) {
        // Default to prefixing with service name for backwards-compatability
        let resourceName = options.prefixWithServiceName === false
            ? options.clusterName
            : `${serviceName}${options.clusterName}`;

        super(options, stage, resourceName, tags);
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
