import {IVPCOptions} from "../options";
import {NamePostFix, Resource} from "../resource";

export class VPC extends Resource<IVPCOptions> {

    private readonly subnets: string[];

    public constructor(stage: string, options: IVPCOptions, tags?: object) {
        super(options, stage, null, tags);
        //subnetIds don't enforce mapping due allowance of instrinsict functions object
        this.subnets = (this.useExistingVPC() ? this.options.subnetIds : this.options.subnets
            .map((subnet: string, index: number): string => `${this.getName(NamePostFix.SUBNET_NAME)}${index}`));
    }

    public getOutputs(): any {
        return {};
    }

    public useExistingVPC(): boolean {
        return !!(this.options.vpcId && this.options.vpcId != 'null' && 
                  this.options.securityGroupIds && (<string><unknown>this.options.securityGroupIds) != 'null' &&
                  this.options.subnetIds && (<string><unknown>this.options.subnetIds) != 'null');
    }

    public getRefName(): any {
        if (this.useExistingVPC()) return this.options.vpcId;
        return { "Ref": super.getName(NamePostFix.VPC) };
    }

    public getSecurityGroups(): string[] {
        return this.options.securityGroupIds;
    }

    public getSubnets(): any[] {
        return (this.useExistingVPC() ? this.options.subnetIds : this.subnets.map(subnet => ({
            "Ref": subnet
        })));
    }

    public generate(): any {
        const vpc: string = this.options.cidr;
        const subnets: string[] = this.options.subnets;
        //vpc in generate only if no existing vpc is specified
        if (!this.useExistingVPC()) return this.generateVPC(vpc, subnets);
        return null;
    }

    /* self created VPC */

    private generateVPC(vpc: string, subnets: string[]): any {
        return Object.assign({
            [this.getName(NamePostFix.VPC)]: {
                "Type": "AWS::EC2::VPC",
                "DeletionPolicy": "Delete",
                "Properties": {
                    ...(this.getTags() ? { "Tags": this.getTags() } : {}),
                    "EnableDnsSupport": true,
                    "EnableDnsHostnames": true,
                    "CidrBlock": vpc
                }
            },
            [this.getName(NamePostFix.INTERNET_GATEWAY)]: {
                "Type": "AWS::EC2::InternetGateway",
                "DeletionPolicy": "Delete",
                "Properties": {
                    ...(this.getTags() ? { "Tags": this.getTags() } : {}),
                }
            },
            [this.getName(NamePostFix.GATEWAY_ATTACHMENT)]: {
                "Type": "AWS::EC2::VPCGatewayAttachment",
                "DeletionPolicy": "Delete",
                "Properties": {
                    "VpcId": {
                        "Ref": this.getName(NamePostFix.VPC)
                    },
                    "InternetGatewayId": {
                        "Ref": this.getName(NamePostFix.INTERNET_GATEWAY)
                    }
                }
            },
            [this.getName(NamePostFix.ROUTE_TABLE)]: {
                "Type": "AWS::EC2::RouteTable",
                "DeletionPolicy": "Delete",
                "Properties": {
                    ...(this.getTags() ? { "Tags": this.getTags() } : {}),
                    "VpcId": {
                        "Ref": this.getName(NamePostFix.VPC)
                    }
                }
            },
            [this.getName(NamePostFix.ROUTE)]: {
                "Type": "AWS::EC2::Route",
                "DeletionPolicy": "Delete",
                "DependsOn": this.getName(NamePostFix.GATEWAY_ATTACHMENT),
                "Properties": {
                    "RouteTableId": {
                        "Ref": this.getName(NamePostFix.ROUTE_TABLE)
                    },
                    "DestinationCidrBlock": "0.0.0.0/0",
                    "GatewayId": {
                        "Ref": this.getName(NamePostFix.INTERNET_GATEWAY)
                    }
                }
            },
        }, ...this.generateSubnets(subnets));
    }
    
    private generateSubnets(subnets: string[]): any[] {
        const subnetNames: string[] = this.options.subnets;

        return subnets.map((subnet: string, index: number): object => {
            const subnetName: string = `${this.getName(NamePostFix.SUBNET_NAME)}${index}`;
            const def: any = {};
            def[subnetName] = {
                "Type": "AWS::EC2::Subnet",
                "DeletionPolicy": "Delete",
                "Properties": {
                    ...(this.getTags() ? { "Tags": this.getTags() } : {}),
                    "AvailabilityZone": {
                        "Fn::Select": [
                            index,
                            {
                                "Fn::GetAZs": {
                                    "Ref": "AWS::Region"
                                }
                            }
                        ]
                    },
                    "VpcId": {
                        "Ref": this.getName(NamePostFix.VPC)
                    },
                    "CidrBlock": subnet,
                    "MapPublicIpOnLaunch": true
                }
            };
            def[`${this.getName(NamePostFix.ROUTE_TABLE_ASSOCIATION)}${index}`] = {
                "Type": "AWS::EC2::SubnetRouteTableAssociation",
                "DeletionPolicy": "Delete",
                    "Properties": {
                    "SubnetId": {
                        "Ref": subnetName
                    },
                    "RouteTableId": {
                        "Ref": this.getName(NamePostFix.ROUTE_TABLE)
                    }
                }
            };
            return def;
        });
    }

}