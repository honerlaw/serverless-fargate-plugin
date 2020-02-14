export enum NamePostFix {
    CLUSTER = "Cluster",
    CONTAINER_SECURITY_GROUP = "ContainerSecurityGroup",
    CONTAINER_NAME = "ContainerName",
    LOAD_BALANCER = "LoadBalancer",
    LOAD_BALANCER_SECURITY_GROUP = "LoadBalancerSecurityGroup",
    LOAD_BALANCER_LISTENER = "LoadBalancerListener",
    LOAD_BALANCER_LISTENER_RULE = "LoadBalancerListenerRule",
    SECURITY_GROUP_INGRESS_ALB = "SecurityGroupIngressAlb",
    SECURITY_GROUP_INGRESS_SELF = "SecurityGroupIngressSelf",
    LOG_GROUP = "LogGroup",

    // VPC specific
    VPC = "VPC",
    SUBNET_NAME = "SubnetName",
    INTERNET_GATEWAY = "InternetGateway",
    GATEWAY_ATTACHMENT = "GatewayAttachement",
    ROUTE_TABLE = "PublicRouteTable",
    ROUTE = "PublicRoute",
    ROUTE_TABLE_ASSOCIATION = "SubnetRouteTableAssociation",

    // Service specific
    SERVICE = "Service",
    TASK_DEFINITION = "TDef",
    TARGET_GROUP = "TGroup",

    // Service auto scaling specific
    AutoScalingRole = "ASRole",
    AutoScalingTarget = "ASTarget", 
    AutoScalingPolicy = "ASPolicy"
}

export abstract class Resource<T> {

    protected readonly options: T;
    protected readonly stage: string;
    private readonly namePrefix: string | undefined;
    protected readonly tags?: object;

    public constructor(options: T, stage: string, namePrefix?: string | undefined, tags?: object) {
        this.options = options;
        this.stage = stage;
        this.namePrefix = namePrefix;
        this.tags = tags;
    }

    public getTags(): Array<object> | null {
        if (this.tags && Object.keys(this.tags).length > 0) {
            return Object.keys(this.tags).map( (tagKey: string) => ({
                "Key": tagKey,
                "Value": this.tags[tagKey]
            }));
        } return null;
    }

    public abstract generate(): any;

    public getName(namePostFix: NamePostFix): string {
        if (this.namePrefix) {
            return this.namePrefix + namePostFix.toString();
        }
        return namePostFix + this.stage;
    }

    public getOptions(): T {
        return this.options;
    }

    public getNamePrefix(): string {
        return this.namePrefix;
    }

    public getOutputs(): any {
        return {};
    }

}
