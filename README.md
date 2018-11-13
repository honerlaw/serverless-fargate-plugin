# serverless-fargate-plugin

Based on templates found here: https://github.com/nathanpeck/aws-cloudformation-fargate

#### Why
This plugin was created because almost all of my other services are running in lambdas. However, I started running other services using ECS Fargate and was using  a mixture of ecs-deploy, cloud formation templates, manual creation / updating, and custom deploy scripts. So I wrote this general plugin to replace those custom scripts / templates / cli tools.

#### Notes
- This implements a Public VPC / Public Subnet / Public Load Balancer approach, I may in the future add the other approaches but for now this suites my personal needs.
- This plugin only supports AWS
- Docker image must be built / uploaded / and properly tagged

#### TODO
- Test / Write Tests
- Better TS Definitions

#### Options
```json
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
        protocols: Array<{
            protocol: "HTTP" | "HTTPS";
            certificateArns?: string[]; // needed for https
        }>;
        imageRepository: string;
        imageTag?: string; //
        priority?: number; // priority for routing, defaults to 1
        path?: string; // path the Load Balancer should send traffic to, defaults to '*'
        desiredCount?: number; // defaults to 1
        taskRoleArn?: string;
        healthCheckUri?: string; // defaults to "/"
        healthCheckProtocol?: string; // defaults to "HTTP"
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
      imageTag: 1.0.0
      imageRepository: xxx.amazonaws.com/xxx
      entryPoint:
      - npm
      - run
      - start
      protocols:
      - protocol: HTTP
        healthCheckUri: /health
      - protocol: HTTPS
        certificateArns:
        - xxxx

```
