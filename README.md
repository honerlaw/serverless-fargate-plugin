# serverless-fargate-plugin

Based on templates found here: https://github.com/nathanpeck/aws-cloudformation-fargate

#### About
This plugin will create a cluster, load balancer, vpc, subnets, and one or more services to associate with it. This plugin implements the Public VPC / Public Load Balancer / Public Subnet approach found in the templates above.

If you would like to reference the VPC elsewhere (such as in the [serverless-aurora-plugin](https://github.com/honerlaw/serverless-aurora-plugin)). The VPC will be called `VPC{stage}` where `{stage}` is the stage in the serverless.yml. The subnets will be called `SubnetName{stage}{index}` where `{stage}`is the stage in the serverless.yml, and `{index}` references the index of the subnet that was specified in the subnets array. *THESE ARE NOT ADDED TO OUTPUT*. So you can only reference them in the same serverless.yml / same cf stack.

#### Notes
- This implements a Public VPC / Public Subnet / Public Load Balancer approach, I may in the future add the other approaches but for now this suites my personal needs.
- This plugin only supports AWS
- Docker image must be built / uploaded / and properly tagged
- It is assumed that the process running in the docker container is listening for HTTP requests.

#### TODO
- Tests
- Better TS Definitions
- Outputs for certain resources
- More options

#### Options
```javascript
{
    executionRoleArn?: string; // execution role for services, generated if not specified
    vpc: {
        cidr: string;
        subnets: string[]; // subnet cidrs
    };
    services: Array<{
        name: string; // name of the service
        cpu: number;
        memory: number;
        port: number; // docker port (the port exposed on the docker image)
        entryPoint: string[]; // same as docker's entry point
        environment: { [key: string]: string }; // environment variables passed to docker container
        protocols: Array<{
            protocol: "HTTP" | "HTTPS";
            certificateArns?: string[]; // needed for https
        }>;
        image?: string; // full image name, REPOSITORY[:TAG]
        imageRepository?: string; // image repository (used if image option is not provided)
        imageTag?: string; // image tag (used if image option is not provided)
        priority?: number; // priority for routing, defaults to 1
        path?: string; // path the Load Balancer should send traffic to, defaults to '*'
        desiredCount?: number; // defaults to 1
        taskRoleArn?: string;
        healthCheckUri?: string; // defaults to "/"
        healthCheckProtocol?: string; // defaults to "HTTP"
        healthCheckInterval?: number // in seconds, defaults to 6 seconds
    }>
}
```

#### Examples
```yaml
service: example-service

provider:
  name: aws
  region: us-east-1
  stage: example

plugins:
- serverless-fargate-plugin

custom:
  fargate:
    vpc:
      cidr: 10.0.0.0/16
      subnets:
      - 10.0.0.0/24
      - 10.0.1.0/24
    services:
    - name: example-service-name
      cpu: 512
      memory: 1024
      port: 80
      healthCheckUri: /health
      healthCheckInterval: 6
      imageTag: 1.0.0
      imageRepository: xxx.amazonaws.com/xxx
      entryPoint:
      - npm
      - run
      - start
      environment:
        PRODUCTION: true
      protocols:
      - protocol: HTTP
      - protocol: HTTPS
        certificateArns:
        - xxxx

```
