"""Tests for engine.text cleaning utilities."""

from engine.text import clean_content, clean_summary, clean_title


class TestCleanTitle:
    def test_basic(self):
        assert clean_title("Hello World") == "Hello World"

    def test_none(self):
        assert clean_title(None) == "Untitled"

    def test_empty(self):
        assert clean_title("") == "Untitled"

    def test_whitespace_only(self):
        assert clean_title("   \n\t  ") == "Untitled"

    def test_strips_pipe_suffix(self):
        assert clean_title("Great Article | The Verge") == "Great Article"

    def test_strips_dash_suffix(self):
        assert clean_title("Great Article - The Verge") == "Great Article"

    def test_strips_double_colon_suffix(self):
        assert clean_title("Great Article :: The Verge") == "Great Article"

    def test_multiple_pipe_separators(self):
        # Should split on the LAST separator
        assert clean_title("Python | The Good Parts | Blog Name") == "Python | The Good Parts"

    def test_keeps_long_suffix(self):
        # Suffix >= 40 chars is not a site name, keep it
        long_suffix = "A" * 40
        title = f"Article | {long_suffix}"
        assert clean_title(title) == title

    def test_only_site_name(self):
        # Nothing before the separator — idx == 0 means left is empty
        # rfind returns 0, but idx > 0 check means we skip stripping
        assert clean_title("| Site Name") == "| Site Name"

    def test_just_separator(self):
        assert clean_title(" | ") == "|"

    def test_normalizes_whitespace(self):
        assert clean_title("  Hello   World  \n\t ") == "Hello World"

    def test_strips_control_chars(self):
        assert clean_title("Hello\x00World\x01!") == "HelloWorld!"

    def test_preserves_newline_as_space(self):
        # Newlines are whitespace, collapsed to single space
        assert clean_title("Line 1\nLine 2") == "Line 1 Line 2"

    def test_truncates_to_255(self):
        long_title = "A" * 300
        result = clean_title(long_title)
        assert len(result) == 255

    def test_unicode_emojis(self):
        assert clean_title("Rocket launch 🚀 today") == "Rocket launch 🚀 today"

    def test_cjk_characters(self):
        assert clean_title("日本語のタイトル | サイト名") == "日本語のタイトル"

    def test_legitimate_pipe_in_title(self):
        # If the suffix after pipe is long (>= 40 chars), it's kept
        title = "Understanding Unix Pipes | A comprehensive deep dive into everything"
        assert clean_title(title) == title


class TestCleanSummary:
    def test_basic(self):
        assert clean_summary("Hello world") == "Hello world"

    def test_none(self):
        assert clean_summary(None) is None

    def test_empty_string(self):
        assert clean_summary("") is None

    def test_whitespace_only(self):
        assert clean_summary("   \n  ") is None

    def test_normalizes_whitespace(self):
        assert clean_summary("Hello   \n  world") == "Hello world"

    def test_strips_control_chars(self):
        assert clean_summary("Hello\x00World") == "HelloWorld"

    def test_truncates_with_ellipsis(self):
        long_text = "A" * 600
        result = clean_summary(long_text)
        assert len(result) == 500
        assert result.endswith("…")
        assert result == "A" * 499 + "…"

    def test_exactly_500_no_ellipsis(self):
        text = "A" * 500
        assert clean_summary(text) == text

    def test_unicode(self):
        assert clean_summary("日本語の要約") == "日本語の要約"


class TestCleanContent:
    def test_basic(self):
        assert clean_content("Hello world") == "Hello world"

    def test_none(self):
        assert clean_content(None) is None

    def test_empty_string(self):
        assert clean_content("") is None

    def test_strips_control_chars(self):
        assert clean_content("Hello\x00World") == "HelloWorld"

    def test_preserves_whitespace(self):
        # Content preserves internal whitespace (paragraphs etc.)
        assert clean_content("Para 1\n\nPara 2") == "Para 1\n\nPara 2"

    def test_truncates_to_100k(self):
        long = "A" * 150_000
        result = clean_content(long)
        assert len(result) == 100_000
