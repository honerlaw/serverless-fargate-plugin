export interface IVPCOptions {
    cidr: string;
    subnets: string[];
}

export interface IServiceProtocolOptions {
    protocol: "HTTP" | "HTTPS";
    certificateArns?: string[]; // needed for https
}

export interface IServiceOptions {
    name: string;
    cpu: number;
    memory: number;
    port: number;
    entryPoint: string[];
    environment: { [key: string]: string };
    protocols: IServiceProtocolOptions[];
    image?: string;
    imageRepository?: string;
    imageTag?: string;
    priority?: number; // priority for routing, defaults to 1
    path?: string; // path the LB should send traffic to, defaults '*' (everything)
    desiredCount?: number; // defaults to 1
    taskRoleArn?: string;
    healthCheckUri?: string; // defaults to "/"
    healthCheckProtocol?: string; // defaults to "HTTP"
    healthCheckInterval?: number // in seconds, defaults to 6 seconds
}

export interface IPluginOptions {
    executionRoleArn?: string; // role for services, generated if not specfied
    vpc: IVPCOptions;
    services: IServiceOptions[];
}
