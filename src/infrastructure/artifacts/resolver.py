from dataclasses import dataclass


@dataclass(frozen=True)
class ResolvedArtifact:
    type: str
    component_id: str
    version: str
    sha256: str
    location: str


class ConventionArtifactResolver:
    def __init__(self, *, artifact_bucket: str, ecr_registry: str) -> None:
        self.artifact_bucket = artifact_bucket
        self.ecr_registry = ecr_registry

    def resolve(
        self,
        *,
        component_type: str,
        component_id: str,
        version: str,
        artifact_sha256: str,
    ) -> ResolvedArtifact:
        if component_type == "lambda":
            location = f"s3://{self.artifact_bucket}/lambda/{component_id}/{version}.zip"
        elif component_type == "ec2-iis":
            location = f"s3://{self.artifact_bucket}/ec2-iis/{component_id}/{version}.zip"
        elif component_type == "ecs":
            location = f"{self.ecr_registry}/{component_id}:{version}"
        else:
            raise ValueError(f"Unsupported component type: {component_type}")

        return ResolvedArtifact(
            type=component_type,
            component_id=component_id,
            version=version,
            sha256=artifact_sha256,
            location=location,
        )
