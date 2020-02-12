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

    // Service Specific
    SERVICE = "Service",
    TASK_DEFINITION = "TDef",
    TARGET_GROUP = "TGroup"
}

export abstract class Resource<T> {

    protected readonly options: T;
    protected readonly stage: string;
    private readonly namePrefix: string | undefined;

    public constructor(options: T, stage: string, namePrefix?: string | undefined) {
        this.options = options;
        this.stage = stage;
        this.namePrefix = namePrefix;
    }

    public abstract generate(): any;

    public getName(namePostFix: NamePostFix): string {
        if (this.namePrefix) {
            return this.namePrefix + namePostFix.toString() + this.stage;
        }
        return namePostFix + this.stage;
    }

    public getOptions(): T {
        return this.options;
    }

    public getNamePrefix(): string {
        return this.namePrefix;
    }

}
