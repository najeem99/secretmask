# Git clean filter (manual setup)

```bash
git config filter.secretmask.clean "secretmask clean"
git config filter.secretmask.smudge cat
echo '*.yml filter=secretmask'        >> .git/info/attributes
echo '*.properties filter=secretmask' >> .git/info/attributes
echo '.env* filter=secretmask'        >> .git/info/attributes
```

`.git/config` and `.git/info/attributes` are local, so nothing here gets committed.
