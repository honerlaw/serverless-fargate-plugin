export enum NamePostFix {
    CLUSTER = "Cluster",
    CONTAINER_SECURITY_GROUP = "ContainerSecGroup",
    CONTAINER_NAME = "ContainerName",
    LOAD_BALANCER = "ALB",
    LOAD_BALANCER_SECURITY_GROUP = "ALBSecGroup",
    LOAD_BALANCER_LISTENER = "ALBListener",
    LOAD_BALANCER_LISTENER_RULE = "ALBListenerRule",
    SECURITY_GROUP_INGRESS_ALB = "ALBSecGroupIngress",
    SECURITY_GROUP_INGRESS_SELF = "SecGroupIngressSelf",
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
    public hasTags(): boolean { 
        return (this.tags && Object.keys(this.tags).length > 0);
    }

    public abstract generate(): any;
    public abstract getOutputs(): any;

    public getName(namePostFix: NamePostFix): string {
        if (this.namePrefix) { return (this.namePrefix + namePostFix + this.stage); }
        return (namePostFix + this.stage);
    }

    public getOptions(): T {
        return this.options;
    }

    public getNamePrefix(): string {
        return this.namePrefix;
    }

}
