def generate_protocol(prefix: str, year: int, sequence: int) -> str:
    normalized_prefix = prefix.strip().upper()

    if not normalized_prefix:
        raise ValueError("prefix must not be empty")

    if year < 1000 or year > 9999:
        raise ValueError("year must have 4 digits")

    if sequence <= 0:
        raise ValueError("sequence must be greater than zero")

    return f"{normalized_prefix}-{year}-{sequence:06d}"
