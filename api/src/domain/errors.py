class ReleaseControllerError(Exception):
    status_code = 500


class NotFoundError(ReleaseControllerError):
    status_code = 404


class ConflictError(ReleaseControllerError):
    status_code = 409


class ValidationError(ReleaseControllerError):
    status_code = 400


class UnauthorizedError(ReleaseControllerError):
    status_code = 401


class ForbiddenError(ReleaseControllerError):
    status_code = 403






