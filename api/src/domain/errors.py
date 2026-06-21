class ReleaseSetControllerError(Exception):
    status_code = 500


class NotFoundError(ReleaseSetControllerError):
    status_code = 404


class ConflictError(ReleaseSetControllerError):
    status_code = 409


class ValidationError(ReleaseSetControllerError):
    status_code = 400


class UnauthorizedError(ReleaseSetControllerError):
    status_code = 401


class ForbiddenError(ReleaseSetControllerError):
    status_code = 403




