class OneReleaseError(Exception):
    status_code = 500


class NotFoundError(OneReleaseError):
    status_code = 404


class ConflictError(OneReleaseError):
    status_code = 409


class ValidationError(OneReleaseError):
    status_code = 400


class UnauthorizedError(OneReleaseError):
    status_code = 401


class ForbiddenError(OneReleaseError):
    status_code = 403






