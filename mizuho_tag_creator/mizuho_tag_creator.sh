#!/bin/bash

# e.g execution -> sh mizuho_tag_creator.sh 1.0.16-SNAPSHOT

# -----------
# Set mizuho dev path AND UNCOMMENT NEXT LINE
# MIZUHO_DEV_PATH=/Users/pablo.atoche/dev/mizuho-global-bloomreach
# -----------

cd $MIZUHO_DEV_PATH
echo "mizuho dev folder: $(pwd)"
1
if [[ $# -eq 0 ]] ; then
    echo 'No TAG supplied'
    exit 1
fi

TAG=$1
vTAG=v$TAG
git stash
git fetch origin
git checkout origin/develop
LATEST_TAG=$(git describe --abbrev=0 --tags)
read -r -p "The latest TAG is $LATEST_TAG, Are you sure to create a new TAG-> $vTAG? [y/N] " response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]
then
    mvn versions:set -D newVersion=$TAG && mvn versions:commit
    git add .
    git commit -m "[tags/$vTAG]"
    git push origin HEAD:develop
    git tag -d $vTAG
    git tag -a $vTAG -m "Release tag for $vTAG"
    git push origin $vTAG
else
    echo "the tag $TAG was not created"
fi