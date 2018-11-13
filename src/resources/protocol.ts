import {NamePostFix, Resource} from "../resource";
import {IServiceProtocolOptions} from "../options";
import {Service} from "./service";
import {Cluster} from "./cluster";

const PORT_MAP: { [key: string]: number } = {
    "HTTP": 80,
    "HTTPS": 443
};

export class Protocol extends Resource<IServiceProtocolOptions> {

    private readonly cluster: Cluster;
    private readonly service: Service;

    public constructor(cluster: Cluster,
                       service: Service,
                       options: IServiceProtocolOptions) {
        super(options, service.getNamePrefix());
        this.cluster = cluster;
        this.service = service;
    }

    public getName(namePostFix: NamePostFix): string {
        return super.getName(namePostFix) + this.options.protocol.toUpperCase();
    }

    public generate(): any {
        if (this.options.protocol === "HTTPS" && (!this.options.certificateArns || this.options.certificateArns.length === 0)) {
            throw new Error('Certificate ARN required for HTTPS');
        }

        var def: any = {
            [this.getName(NamePostFix.TARGET_GROUP)]: {
                "Type": "AWS::ElasticLoadBalancingV2::TargetGroup",
                "Properties": {
                    "HealthCheckIntervalSeconds": 6,
                    "HealthCheckPath": this.options.healthCheckUri ? this.options.healthCheckUri : "/",
                    "HealthCheckProtocol": this.options.healthCheckProtocol ? this.options.healthCheckProtocol : "HTTP",
                    "HealthCheckTimeoutSeconds": 5,
                    "HealthyThresholdCount": 2,
                    "TargetType": "ip",
                    "Name": this.service.getOptions().name,
                    "Port": this.service.getOptions().port,
                    "Protocol": this.options.protocol,
                    "UnhealthyThresholdCount": 2,
                    "VpcId": {
                        "Ref": this.cluster.getVPC().getName(NamePostFix.VPC)
                    }
                }
            },
            [this.getName(NamePostFix.LOAD_BALANCER_LISTENER)]: {
                "Type": "AWS::ElasticLoadBalancingV2::Listener",
                "DependsOn": [
                    this.cluster.getName(NamePostFix.LOAD_BALANCER)
                ],
                "Properties": {
                    "DefaultActions": [
                        {
                            "TargetGroupArn": {
                                "Ref": this.getName(NamePostFix.TARGET_GROUP)
                            },
                            "Type": "forward"
                        }
                    ],
                    "LoadBalancerArn": {
                        "Ref": this.cluster.getName(NamePostFix.LOAD_BALANCER)
                    },
                    "Port": PORT_MAP[this.options.protocol],
                    "Protocol": this.options.protocol
                }
            },
            [this.getName(NamePostFix.LOAD_BALANCER_LISTENER_RULE)]: {
                "Type": "AWS::ElasticLoadBalancingV2::ListenerRule",
                "Properties": {
                    "Actions": [{
                        "TargetGroupArn": {
                            "Ref": this.getName(NamePostFix.TARGET_GROUP)
                        },
                        "Type": "forward"
                    }],
                    "Conditions": [
                        {
                            "Field": "path-pattern",
                            "Values": [this.service.getOptions().path ? this.service.getOptions().path : '*']
                        }
                    ],
                    "ListenerArn": {
                        "Ref": this.getName(NamePostFix.LOAD_BALANCER_LISTENER)
                    },
                    "Priority": this.service.getOptions().priority ? this.service.getOptions().priority : 1
                }
            }
        };

        if (this.options.protocol === "HTTPS") {
            def[this.getName(NamePostFix.LOAD_BALANCER_LISTENER)].Properties.Certificates = this.options
                .certificateArns.map((certificateArn: string): any => ({
                    "CertificateArn": certificateArn
                }));
        }

        return def;
    }

}
