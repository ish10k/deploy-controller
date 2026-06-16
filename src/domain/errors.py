class DeploySetControllerError(Exception):
    status_code = 500


class NotFoundError(DeploySetControllerError):
    status_code = 404


class ConflictError(DeploySetControllerError):
    status_code = 409


class ValidationError(DeploySetControllerError):
    status_code = 400

