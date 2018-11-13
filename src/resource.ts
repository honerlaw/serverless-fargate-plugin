export enum NamePostFix {
    CLUSTER = "Cluster",
    CONTAINER_SECURITY_GROUP = "ContainerSecurityGroup",
    LOAD_BALANCER = "LoadBalancer",
    LOAD_BALANCER_SECURITY_GROUP = "LoadBalancerSecurityGroup",
    LOAD_BALANCER_LISTENER = "LoadBalancerListener",
    LOAD_BALANCER_LISTENER_RULE = "LoadBalancerListenerRule",
    SECURITY_GROUP_INGRESS_ALB = "SecurityGroupIngressAlb",
    SECURITY_GROUP_INGRESS_SELF = "SecurityGroupIngressSelf",

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
    private readonly namePrefix: string | undefined;

    public constructor(options: T, namePrefix?: string | undefined) {
        this.options = options;
        this.namePrefix = namePrefix;
    }

    public abstract generate(): any;

    public getName(namePostFix: NamePostFix, ...prefixes: string[]): string {
        const prefix: string = !prefixes ? '' : prefixes
            .map((prefix: string): string => prefix.charAt(0).toUpperCase() + prefix.substring(1).toLowerCase())
            .join('');

        if (this.namePrefix) {
            return this.namePrefix + namePostFix.toString() + prefix;
        }
        return namePostFix + prefix;
    }

    public getOptions(): T {
        return this.options;
    }

    public getNamePrefix(): string {
        return this.namePrefix;
    }

}