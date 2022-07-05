import { CfnOutput, Fn, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Cluster, ContainerImage, LogDriver } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService, ApplicationLoadBalancedServiceRecordType } from 'aws-cdk-lib/aws-ecs-patterns';
import { ApplicationProtocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import { WebDeployStack } from "./web-deploy-stack";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

interface TegolaCdkTestStackProps extends StackProps {
  vpcId: string;
}
export class TegolaMapTestStack extends Stack {
  constructor(scope: Construct, id: string, props: TegolaCdkTestStackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const { env, vpcId } = props;

    const vpc = Vpc.fromLookup(this, "Vpc", {
      vpcId,
    });

    //Create the  repository.
    const repository = new Repository(this, "Repository", {
      repositoryName: "eniro/tegola-liang",
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // "EcrArn" is the key, "ecrArn-liang" is the export name
    new CfnOutput(this, "EcrArn", {
      value: repository.repositoryArn,
      exportName: "ecrArn-liang",
      description: "this the cotainer repository for liang testing"
    });
    new CfnOutput(this, "EcrName", {
      value: repository.repositoryName,
      exportName: "ecrName-liang",
    });
    
    const APP_PORT = 8080;
    const cluster = new Cluster(this, "TegolaServiceECSCluster", {
      clusterName: "TegoleLiangServiceECSCluster",
      containerInsights: true,
      vpc,
    });

    const fargateService = new ApplicationLoadBalancedFargateService(
      this,
      "TegolaServiceFargateService",
      {
        serviceName: "TegolaServiceFargateService",
        cluster,
        cpu: 2048,
        desiredCount: 1,
        memoryLimitMiB: 4096,
        publicLoadBalancer: true,
        //protocol: ApplicationProtocol.HTTPS,
        protocol: ApplicationProtocol.HTTP,
        //certificate,
        //redirectHTTP: true,
        //domainName: fullyQualifiedPrimaryHost,
        //domainZone: zone,
        recordType: ApplicationLoadBalancedServiceRecordType.CNAME,
        taskImageOptions: {
          image: ContainerImage.fromEcrRepository(repository, "latest"),
          containerPort: APP_PORT,
          containerName: "tegolaServiceWeb",
          logDriver: LogDriver.awsLogs({
            streamPrefix: "tegola-service-logs",
         //   logGroup,
          }),
          // secrets: {
          //   DB_USER: Secret.fromSecretsManager(secret, "username"),
          //   DB_PASSWORD: Secret.fromSecretsManager(secret, "password"),
          // },
          // environment: {
          //   DB_HOST: host,
          //   DB_PORT: port.toString(),
          //   // DB_NAME: name,
          //   DB_NAME: "geofabrik",
          //   CACHE_BUCKET: cacheBucket.bucketName,
          // },
        },
        circuitBreaker: { rollback: true },
      }
    );

    // Configure auto-scaling.
    const scalableTarget = fargateService.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 5,
    });

    scalableTarget.scaleOnMemoryUtilization("ScaleUpMem", {
      targetUtilizationPercent: 75,
    });

    scalableTarget.scaleOnCpuUtilization("ScaleUpCpu", {
      targetUtilizationPercent: 70,
    });

    new WebDeployStack(this, "TegolaWebDeployStack", {
      env,
      service: fargateService.service,
      repositoryName: Fn.importValue("ecrName-liang"),
      repositoryArn: Fn.importValue("ecrArn-liang"),
      imageTag: "latest",
      containerName: "tegolaServiceWeb",
    });
  }
}
