"""Loads the ISO 27001 Maturity Assessment workbooks into DataFrames on startup."""
import os
import sys

import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILE_2026 = os.path.join(BASE_DIR, "ISO 27001 Maturity Assessments 2026.xlsx")
FILE_2027 = os.path.join(BASE_DIR, "ISO 27001 Maturity Assessments 2027.xlsx")


def load_assessment(path: str) -> pd.DataFrame:
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Required assessment file not found: {path}")
    try:
        return pd.read_excel(path)
    except Exception as exc:
        raise RuntimeError(f"Failed to read assessment file '{path}': {exc}") from exc


def load_assessments() -> tuple[pd.DataFrame, pd.DataFrame]:
    return load_assessment(FILE_2026), load_assessment(FILE_2027)


if __name__ == "__main__":
    try:
        df1, df2 = load_assessments()
    except (FileNotFoundError, RuntimeError) as exc:
        print(f"Error loading assessment data: {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"Loaded 2026 assessment: {df1.shape[0]} rows, {df1.shape[1]} columns")
    print(f"Loaded 2027 assessment: {df2.shape[0]} rows, {df2.shape[1]} columns")
