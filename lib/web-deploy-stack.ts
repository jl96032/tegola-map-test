import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import {
  BuildSpec,
  LinuxBuildImage,
  PipelineProject,
} from "aws-cdk-lib/aws-codebuild";
import { Artifact, Pipeline } from "aws-cdk-lib/aws-codepipeline";
import {
  CodeBuildAction,
  EcrSourceAction,
  EcsDeployAction,
} from "aws-cdk-lib/aws-codepipeline-actions";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { IBaseService } from "aws-cdk-lib/aws-ecs";
import { Construct } from "constructs";

interface WebDeployStackProps extends StackProps {
  service: IBaseService;
  repositoryName: string;
  repositoryArn: string;
  imageTag: string;
  containerName: string;
}

export class WebDeployStack extends Stack {
  constructor(scope: Construct, id: string, props: WebDeployStackProps) {
    super(scope, id, props);

    const { service, repositoryName, repositoryArn, imageTag, containerName } =
      props;

    const repository = Repository.fromRepositoryAttributes(
      this,
      "EcrRepository",
      {
        repositoryName,
        repositoryArn,
      }
    );

    const sourceOutput = new Artifact("SourceOutput");

    const transformedOutput = new Artifact("TransformedOutput");

    const buildProject = new PipelineProject(
      this,
      "WebDeployEcrTransformPipeline",
      {
        buildSpec: BuildSpec.fromObject({
          version: 0.2,
          phases: {
            build: {
              commands: [
                // https://docs.aws.amazon.com/codepipeline/latest/userguide/file-reference.html#pipelines-create-image-definitions
                `echo "[{\\"name\\":\\"$CONTAINER_NAME\\",\\"imageUri\\":\\"$REPOSITORY_URI\\"}]" > imagedefinitions.json`,
              ],
            },
          },
          artifacts: {
            files: ["imagedefinitions.json"],
          },
        }),
        environment: {
          buildImage: LinuxBuildImage.STANDARD_5_0,
        },
        environmentVariables: {
          // Container name as it exists in the task definition
          CONTAINER_NAME: {
            value: containerName,
          },
          // ECR URI
          REPOSITORY_URI: {
            value: `${repository.repositoryUri}:${imageTag}`,
          },
        },
      }
    );

    // Grant access to detect ECR pushes
    repository.grantPullPush(buildProject.grantPrincipal);

    const pipeline = new Pipeline(this, "WebDeployPipeline", {
      stages: [
        // If something is pushed to the referenced ECR repository…
        {
          stageName: "Source",
          actions: [
            new EcrSourceAction({
              actionName: "Push",
              repository,
              imageTag, // optional, default: 'latest'
              output: sourceOutput,
            }),
          ],
        },
        // …then run the build pipeline above to create `imagedefinitions.json`…
        {
          stageName: "Build",
          actions: [
            new CodeBuildAction({
              actionName: "Build",
              input: sourceOutput,
              outputs: [transformedOutput],
              project: buildProject,
            }),
          ],
        },
        // …and trigger an ECS deploy based on the previously created `imagedefinitions.json`
        {
          stageName: "Deploy",
          actions: [
            new EcsDeployAction({
              actionName: "Deploy",
              input: transformedOutput,
              service,
            }),
          ],
        },
      ],
    });

    new CfnOutput(this, "PipelineRoleArn", {
      value: pipeline.role.roleArn,
    });
  }
}
