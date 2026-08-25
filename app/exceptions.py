from pydantic import ValidationError


class LLMOutputError(Exception):
    """LLMが不正な出力を返した時の基底例外。"""


class LLMParseError(LLMOutputError):
    """LLMの出力がJSONとして解析できない場合。"""

    def __init__(self, message: str, raw_output: str) -> None:
        super().__init__(message)
        self.raw_output = raw_output


class LLMValidationError(LLMOutputError):
    """LLMの出力がPydanticスキーマに合致しない場合。"""

    def __init__(self, message: str, validation_error: ValidationError, raw_output: str) -> None:
        super().__init__(message)
        self.validation_error = validation_error
        self.raw_output = raw_output

    def user_facing_errors(self) -> list[str]:
        result = []
        for e in self.validation_error.errors():
            loc = ".".join(str(l) for l in e["loc"])
            result.append(f"{loc}: {e['msg']}")
        return result


class LLMRetryExhaustedError(LLMOutputError):
    """リトライを使い切っても正しい出力が得られない場合。"""

    def __init__(self, message: str, last_error: LLMOutputError) -> None:
        super().__init__(message)
        self.last_error = last_error
