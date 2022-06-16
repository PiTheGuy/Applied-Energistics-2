export default async function ({github, context, branch, core}) {

    // Matches tags like fabric/v1.0.0...
    const tagRegexp = /^(?:v|.*\/v)(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-.+)?(?:\+.+)?$/;

    const {owner, repo} = context.repo;

    let buildNumber = context.runNumber;
    let latestRelease;
    let version;
    let releaseVersion;
    let page;
    // Retrieves the last releases in batches of 10 and find the last release for the branch we're building for
    for (page = 0; page < 10 && !version; page++) {
        const {data: releases} = await github.rest.repos.listReleases({
            owner,
            repo,
            per_page: 10,
            page
        });
        latestRelease = releases.find(r => r.target_commitish === branch);
        if (!latestRelease || !latestRelease.tag_name) {
            continue;
        }

        // Check it has a version number we can actually work with
        const versionInTag = latestRelease.tag_name.replace(/^/, "");
        const versionMatch = tagRegexp.exec(versionInTag);
        if (versionMatch) {
            const [_, major, minor, patch] = versionMatch;
            version = `${major}.${minor}.${parseInt(patch) + 1}-nightly.${buildNumber}`;
            releaseVersion = versionMatch;
        }
    }

    if (!latestRelease) {
        throw new Error(`Couldn't find latest release for branch '${branch}'`);
    } else {
        console.info(`Latest release for branch '${branch}': '${latestRelease.html_url}' (page #${page})`);
        console.info(`Nightly version: ${version}`);
    }

    const randomNonExistingTagname = "nightly-" + Math.random();
    const releaseNotes = await github.rest.repos.generateReleaseNotes({
        owner,
        repo,
        tag_name: randomNonExistingTagname,
        target_commitish: branch,
        previous_tag_name: latestRelease.tag_name
    });

    // Fixup the full release note link
    const releaseNotesBody = releaseNotes.data.body.replaceAll(randomNonExistingTagname, encodeURIComponent(branch));

    core.exportVariable('release_notes', releaseNotesBody);
    core.exportVariable('version', version);
    core.exportVariable('release_version', releaseVersion);
}
