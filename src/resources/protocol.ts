import {NamePostFix, Resource} from "../resource";
import {IServiceProtocolOptions} from "../options";
import {Service} from "./service";
import {Cluster} from "./cluster";

export class Protocol extends Resource<IServiceProtocolOptions> {

    private readonly cluster: Cluster;
    private readonly service: Service;
    public readonly port: number;

    public constructor(cluster: Cluster,
                       service: Service,
                       stage: string,
                       options: IServiceProtocolOptions, 
                       port: number,
                       tags?: object) {
        super(options, stage, service.getNamePrefix(), tags);
        this.cluster = cluster;
        this.service = service;
        this.port = port;
    }

    public getName(namePostFix: NamePostFix): string {
        return super.getName(namePostFix) + this.options.protocol.toUpperCase();
    }

    public getOutputs(): any {
        if (this.cluster.getOptions().disableELB || this.service.getOptions().disableELB) return {};
        return {
            [this.cluster.getName(NamePostFix.CLUSTER) + this.service.getName(NamePostFix.SERVICE) + this.options.protocol]: {
                "Description": "Elastic load balancer service endpoint",
                "Export": {
                    "Name": this.cluster.getName(NamePostFix.CLUSTER) + this.service.getName(NamePostFix.SERVICE) + this.options.protocol
                },
                "Value": {
                    "Fn::Join": [
                        "",
                        [
                            this.options.protocol.toLowerCase(),
                            "://",
                            { "Fn::GetAtt": [this.cluster.loadBalancer.getName(NamePostFix.LOAD_BALANCER), "DNSName"] },
                            ":",
                            this.port 
                        ]
                    ]
                }
            }
        };
    }

    public generate(): any {
        if (this.cluster.getOptions().disableELB || this.service.getOptions().disableELB) return {};
        if (this.options.protocol === "HTTPS" && (!this.options.certificateArns || this.options.certificateArns.length === 0)) {
            throw new Error('Certificate ARN required for HTTPS');
        }
        return this.getListenerRules();
    }
    public getListenerRulesName(): string[] {
        if (typeof this.service.getOptions().path === 'string') {
            return [`${this.getName(NamePostFix.LOAD_BALANCER_LISTENER_RULE)}${0}`];
        } else if (Array.isArray(this.service.getOptions().path)) {
            const rules: any = this.service.getOptions().path;
            return rules.map((p, index) => {
                return `${this.getName(NamePostFix.LOAD_BALANCER_LISTENER_RULE)}${index}`;
            });
        } else {
            return [`${this.getName(NamePostFix.LOAD_BALANCER_LISTENER_RULE)}${0}`];
        }
    }
    protected getListenerRules(): any {
        if (typeof this.service.getOptions().path === 'string') {
            const path: any = this.service.getOptions().path;
            return this.generateListenerRule(path, 0);
        } else if (Array.isArray(this.service.getOptions().path)) {
            const rules: any = this.service.getOptions().path;
            let _retRules = {};
            rules.forEach((p, index) => {
                _retRules = {
                    ..._retRules,
                    ...this.generateListenerRule((p.path || p), index, p.method)
                };
            });
            return _retRules;
        } else {
            return this.generateListenerRule('*', 0);
        }
    }
    private generateListenerRule(path: string, index: number, method?: string): any {
        return {
            [`${this.getName(NamePostFix.LOAD_BALANCER_LISTENER_RULE)}${index}`]: {
                "Type": "AWS::ElasticLoadBalancingV2::ListenerRule",
                "DeletionPolicy": "Delete",
                "Properties": {
                    "Actions": [{
                        "TargetGroupArn": {
                            "Ref": this.service.getName(NamePostFix.TARGET_GROUP)
                        },
                        "Type": "forward"
                    }],
                    "Conditions": [
                        {
                            "Field": "path-pattern",
                            "Values": [path]
                        },
                        ...(method && method != '*' && method != 'ANY' ? [{
                            "Field": "http-request-method",
                            "HttpRequestMethodConfig": { "Values": [method] }
                        }] : [{}])
                    ],
                    "ListenerArn": {
                        "Ref": this.cluster.loadBalancer.getName(NamePostFix.LOAD_BALANCER_LISTENER) + this.port
                    },
                    // increase priority if have more than one handler -- todo: find a way to follow user dictated
                    // priority while not reusing priority for the same service but different rules.
                    "Priority": (this.service.getOptions().priority ? this.service.getOptions().priority : 1) + index
                }
            }
        }
    }

}
