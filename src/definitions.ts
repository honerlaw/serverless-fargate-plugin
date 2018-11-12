
export interface IVPCOptions {
    cidr: string;
    subnets: string[];
}

export interface IServiceProtocol {
    protocol: "HTTP" | "HTTPS";
    healthCheckUri?: string; // defaults to "/"
    healthCheckProtocol?: string; // defaults to "HTTP"
}

export interface IServiceOptions {
    name: string;
    cpu: number;
    memory: number;
    port: number;
    entryPoint: string[];
    protocols: IServiceProtocol[];
    imageRepository?: string;
    imageTag?: string;
    priority?: number; // priority for routing, defaults to 1
    path?: string; // path the LB should send traffic to, defaults '*' (everything)
    desiredCount?: number; // defaults to 1
    taskRoleArn?: string;
}

export interface IPluginOptions {
    executionRoleArn?: string; // role for services, generated if not specfied
    imageRepository?: string; // global repository to use for pulling images, if no service is specified, uses this one
    vpc: IVPCOptions;
    services: IServiceOptions[];
}

export interface IResourceGenerator {
    generate: () => any;
}
