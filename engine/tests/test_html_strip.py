"""Tests for engine.html_strip.strip_html."""

from engine.html_strip import strip_html


def test_none_returns_none():
    assert strip_html(None) is None


def test_empty_string():
    assert strip_html("") == ""


def test_plain_text_unchanged():
    assert strip_html("Hello world") == "Hello world"


def test_simple_html_tags():
    assert strip_html("<p>Hello</p>") == "Hello"


def test_nested_html():
    assert strip_html("<div><p><strong>Bold</strong> text</p></div>") == "Bold text"


def test_html_comments():
    result = strip_html("<!-- SC_OFF --><div>content</div><!-- SC_ON -->")
    assert result == "content"


def test_reddit_html():
    html = '<!-- SC_OFF --><div class="md"><p>Check out this article about AI</p></div><!-- SC_ON -->'
    result = strip_html(html)
    assert result == "Check out this article about AI"


def test_html_entities():
    assert strip_html("Tom &amp; Jerry") == "Tom & Jerry"
    assert strip_html("&lt;not a tag&gt;") == "<not a tag>"
    assert strip_html("Price: &#36;10") == "Price: $10"


def test_html_entities_inside_tags():
    assert strip_html("<p>A &amp; B</p>") == "A & B"


def test_script_tags_removed():
    html = "<p>Hello</p><script>alert('xss')</script><p>World</p>"
    result = strip_html(html)
    assert "alert" not in result
    assert "Hello" in result
    assert "World" in result


def test_style_tags_removed():
    html = "<style>.red { color: red; }</style><p>Text</p>"
    result = strip_html(html)
    assert "color" not in result
    assert "Text" in result


def test_self_closing_tags():
    result = strip_html("Line 1<br/>Line 2")
    assert "Line 1" in result
    assert "Line 2" in result


def test_multiline_html():
    html = """<div>
    <p>Paragraph one</p>
    <p>Paragraph two</p>
</div>"""
    result = strip_html(html)
    assert "Paragraph one" in result
    assert "Paragraph two" in result


def test_whitespace_collapse():
    result = strip_html("<p>  lots   of   spaces  </p>")
    assert result == "lots of spaces"


def test_title_with_html():
    assert strip_html("<b>Breaking:</b> News") == "Breaking: News"


def test_attributes_stripped():
    html = '<a href="https://example.com" class="link">Click here</a>'
    assert strip_html(html) == "Click here"


def test_multiline_script():
    html = """<script type="text/javascript">
    var x = 1;
    console.log(x);
    </script>Real content"""
    result = strip_html(html)
    assert result == "Real content"
    assert "console" not in result
