"""Regression tests for changelog entry validation, grouping, generation and check mode."""

from contextlib import redirect_stderr, redirect_stdout
import io
import json
from pathlib import Path
import tempfile
import unittest

from changelog import BUNDLE, DOCUMENT, EntryError, groups, main, parse_entry


def entry_text(**overrides):
    keys = {"date": "2026-11-17", "type": "added", "impact": "high", "title": "Synthetic change"}
    keys.update(overrides)
    front = "".join(f"{key}: {value}\n" for key, value in keys.items() if value is not None)
    return f"---\n{front}---\nWhat people see.\n"


class ParseTests(unittest.TestCase):
    def test_reads_keys_summary_and_notes(self):
        text = entry_text(area="Bench", link="/bench/runs", pr="45", release="0.2.0")
        text += "\n## Technical notes\n\nMigration 0042 adds a column.\n"
        entry = parse_entry("2026-11-17-synthetic-change.md", text)
        self.assertEqual(entry["id"], "2026-11-17-synthetic-change")
        self.assertEqual(entry["pr"], 45)
        self.assertEqual(entry["summary"], "What people see.")
        self.assertEqual(entry["notes"], "Migration 0042 adds a column.")
        self.assertEqual(entry["release"], "0.2.0")

    def test_notes_are_optional(self):
        entry = parse_entry("2026-11-17-a.md", entry_text())
        self.assertNotIn("notes", entry)

    def test_rejects_invalid_entries_naming_file_and_key(self):
        cases = {
            "type": entry_text(type="improved"),
            "impact": entry_text(impact="critical"),
            "date": entry_text(date="2026-02-30"),
            "'date' must be YYYY-MM-DD": entry_text(date="17/11/2026"),
            "missing required key 'title'": entry_text(title=None),
            "missing required key 'impact'": entry_text(impact=None),
            "unknown key 'owner'": entry_text(owner="someone"),
            "'pr'": entry_text(pr="#45"),
            "'release'": entry_text(release="v0.2"),
            "'link'": entry_text(link="bench/runs"),
            "period": entry_text(title="Ends with a period."),
        }
        for expected, text in cases.items():
            with self.subTest(expected), self.assertRaises(EntryError) as raised:
                parse_entry("2026-11-17-bad.md", text)
            self.assertIn("changelog.d/2026-11-17-bad.md", str(raised.exception))
            self.assertIn(expected, str(raised.exception))

    def test_rejects_structure_problems(self):
        cases = {
            "file name": ("Change.md", entry_text()),
            "front matter": ("2026-11-17-a.md", "date: 2026-11-17\n"),
            "appears twice": ("2026-11-17-a.md", entry_text().replace("---\nWhat", "type: fixed\n---\nWhat")),
            "summary": ("2026-11-17-a.md", entry_text().replace("What people see.\n", "\n")),
            "headings": ("2026-11-17-a.md", entry_text() + "\n## Details\n\nMore.\n"),
            "is empty": ("2026-11-17-a.md", entry_text() + "\n## Technical notes\n\n"),
        }
        for expected, (name, text) in cases.items():
            with self.subTest(expected), self.assertRaisesRegex(EntryError, expected):
                parse_entry(name, text)


def made(id_, date, impact="high", title="T", release=None):
    entry = {"id": id_, "date": date, "type": "added", "impact": impact, "title": title, "summary": "S"}
    if release:
        entry["release"] = release
    return entry


class GroupTests(unittest.TestCase):
    def test_unreleased_first_then_releases_newest_first_with_date_ranges(self):
        grouped = groups([
            made("a", "2026-10-22", release="0.1.1"),
            made("b", "2026-11-02", release="0.1.10"),
            made("c", "2026-10-30", release="0.1.10"),
            made("d", "2026-11-17"),
            made("e", "2026-11-03", release="0.1.2"),
        ])
        self.assertEqual([g["release"] for g in grouped], [None, "0.1.10", "0.1.2", "0.1.1"])
        self.assertEqual((grouped[1]["from"], grouped[1]["to"]), ("2026-10-30", "2026-11-02"))

    def test_orders_by_impact_then_newest_then_title(self):
        grouped = groups([
            made("a", "2026-11-01", "low", "Low"),
            made("b", "2026-11-01", "high", "Beta"),
            made("c", "2026-11-01", "high", "alpha"),
            made("d", "2026-11-05", "high", "Zulu"),
            made("e", "2026-11-03", "medium", "Medium"),
        ])
        impacts = grouped[0]["impacts"]
        self.assertEqual([i["impact"] for i in impacts], ["high", "medium", "low"])
        self.assertEqual([e["title"] for e in impacts[0]["entries"]], ["Zulu", "alpha", "Beta"])

    def test_omits_empty_impacts(self):
        grouped = groups([made("a", "2026-11-01", "low")])
        self.assertEqual([i["impact"] for i in grouped[0]["impacts"]], ["low"])


class CommandTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "changelog.d").mkdir()
        self.write("2026-10-22-first.md", entry_text(date="2026-10-22", title="First", release="0.1.1"))
        self.write(
            "2026-11-17-second.md",
            entry_text(type="fixed", impact="low", title="Second", pr="7")
            + "\n## Technical notes\n\nLine one.\n\nLine two.\n",
        )

    def tearDown(self):
        self.temp.cleanup()

    def write(self, name, text):
        (self.root / "changelog.d" / name).write_text(text)

    def run_main(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = main(list(args), root=self.root)
        return code, out.getvalue(), err.getvalue()

    def test_writes_document_and_bundle_then_check_passes(self):
        self.assertEqual(self.run_main()[0], 0)
        document = (self.root / DOCUMENT).read_text()
        self.assertTrue(document.startswith("<!-- Generated by scripts/changelog.py"))
        self.assertLess(document.index("## Unreleased (2026-11-17)"), document.index("## 0.1.1 (2026-10-22)"))
        self.assertIn("### Low impact\n\n- **Fixed:** Second (2026-11-17, [#7](", document)
        self.assertIn("  Technical notes:\n\n  Line one.\n\n  Line two.\n", document)
        bundle = json.loads((self.root / BUNDLE).read_text())
        self.assertEqual([g["release"] for g in bundle["groups"]], [None, "0.1.1"])

    def test_check_validates_entries_only_and_never_asks_for_outputs(self):
        self.assertEqual(self.run_main("--check")[0], 0)
        self.assertFalse((self.root / DOCUMENT).exists())
        self.assertFalse((self.root / BUNDLE).exists())
        self.write("2026-11-18-bad.md", entry_text(type="improved"))
        self.assertEqual(self.run_main("--check")[0], 1)

    def test_bundle_writes_only_the_bundle(self):
        self.assertEqual(self.run_main("--bundle")[0], 0)
        self.assertTrue((self.root / BUNDLE).is_file())
        self.assertFalse((self.root / DOCUMENT).exists())

    def test_require_release_also_needs_a_current_document(self):
        self.run_main("--release", "0.1.2")
        self.assertEqual(self.run_main("--check", "--require-release")[0], 0)
        (self.root / DOCUMENT).write_text((self.root / DOCUMENT).read_text() + "hand edit\n")
        code, _, err = self.run_main("--check", "--require-release")
        self.assertEqual(code, 1)
        self.assertIn("CHANGELOG.md is out of date", err)
        self.assertEqual(self.run_main()[0], 0)
        self.assertNotIn("hand edit", (self.root / DOCUMENT).read_text())

    def test_invalid_entry_fails_without_writing(self):
        self.write("2026-11-18-bad.md", entry_text(type="improved"))
        code, _, err = self.run_main()
        self.assertEqual(code, 1)
        self.assertIn("changelog.d/2026-11-18-bad.md: key 'type'", err)
        self.assertFalse((self.root / DOCUMENT).exists())

    def test_release_stamps_unreleased_entries_and_require_release(self):
        self.run_main()
        code, _, err = self.run_main("--check", "--require-release")
        self.assertEqual(code, 1)
        self.assertIn("2026-11-17-second", err)
        code, out, _ = self.run_main("--release", "0.1.2")
        self.assertEqual(code, 0)
        self.assertIn("Stamped changelog.d/2026-11-17-second.md with release 0.1.2", out)
        self.assertNotIn("first", out)
        text = (self.root / "changelog.d" / "2026-11-17-second.md").read_text()
        self.assertIn("pr: 7\nrelease: 0.1.2\n---\n", text)
        self.assertEqual(self.run_main("--check", "--require-release")[0], 0)
        self.assertNotIn("## Unreleased", (self.root / DOCUMENT).read_text())
        self.assertEqual(self.run_main("--release", "next")[0], 1)


if __name__ == "__main__":
    unittest.main()
