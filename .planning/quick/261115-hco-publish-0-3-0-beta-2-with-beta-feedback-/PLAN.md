# Publish 0.3.0-beta.2

User explicitly requested a beta release after pushing the completed feedback revision on milestone-v0.3. Execute inline on that branch, preserve unrelated local changes, and leave stable acceptance open.

1. Align manifest/package/lock/version metadata, update current install instructions and add accurate beta.2 release notes.
2. Run full checks; commit and tag the exact verified candidate, then atomically push the branch and beta.2 tag through the existing prerelease workflow.
3. Confirm successful workflow, prerelease status, stable Latest=0.2.0, and downloaded assets matching the tested bundle/tagged source. Record hashes, release URL and unresolved physical mobile/BRAT checks in summary and state.
