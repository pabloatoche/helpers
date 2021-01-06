import os
import sys
from time import time

CATEGORYINFOS_LINE = "jcr:primaryType: hippotaxonomy:categoryinfos"
ENGLISH_LINE = "/en:"
NEW_LANG_LINE = "/{}:"
CATEGORYINFO_LINE = "jcr:primaryType: hippotaxonomy:categoryinfo"
ADD_TAXONOMY_LINE_FORMAT = " [{}]"
OUTPUT_FILE_NAME_FORMAT = "{}." + str(int(time() * 1000))
LOCALES_KEY = "hippotaxonomy:locales:"
TAXONOMY = 'hippotaxonomy:name:'
TAXONOMY_WITH_AMP = TAXONOMY + ' \''


def add_lang_in_new_file(file_path, new_lang):
    output_file_path = OUTPUT_FILE_NAME_FORMAT.format(file_path)
    output_file = open(output_file_path, "w")
    new_lang_tax_line = NEW_LANG_LINE.format(new_lang)
    with open(file_path) as fp:
        is_categoryinfos_line = False
        is_english_lang_line = False
        is_categoryinfo_line = False
        last_english_lang_line = None
        last_categoryinfo_line = None
        for line in fp:
            if line.find(LOCALES_KEY) != -1:
                if line.find(' ' + new_lang) != -1:
                    line = line.replace(', ' + new_lang, '')
                    line = line.replace(' ' + new_lang, '')
                output_file.write(line.replace('en', 'en, ' + new_lang))
            else:
                output_file.write(line)

            if line.find(CATEGORYINFOS_LINE) != -1:
                is_categoryinfos_line = True
            elif is_categoryinfos_line and line.find(ENGLISH_LINE) != -1:
                is_english_lang_line = True
                last_english_lang_line = line
            elif is_categoryinfos_line and is_english_lang_line and line.find(CATEGORYINFO_LINE) != -1:
                is_categoryinfo_line = True
                last_categoryinfo_line = line
            elif is_categoryinfos_line and is_english_lang_line and is_categoryinfo_line:
                output_file.write(last_english_lang_line.replace(ENGLISH_LINE, new_lang_tax_line))
                output_file.write(last_categoryinfo_line)
                new_line = None
                if line.find(TAXONOMY_WITH_AMP) != -1:
                    new_line = line.rstrip()
                    new_line = new_line[:-1:]
                    new_line = new_line + ADD_TAXONOMY_LINE_FORMAT.format(new_lang.upper()) + "\'\n"
                else:
                    new_line = line.rstrip() + ADD_TAXONOMY_LINE_FORMAT.format(new_lang.upper()) + "\n"
                output_file.write(new_line)
                last_english_lang_line = None
                last_categoryinfo_line = None
                is_categoryinfos_line = False
                is_english_lang_line = False
                is_categoryinfo_line = False

    output_file.close()
    return output_file_path
    # Press the green button in the gutter to run the script.


def remove_duplicates(file_path, languages):
    output_file = open(output_file_path + '.yml', "w")
    my_map = {}
    lang_taxs = []
    is_in_categoryinfos_part = False
    last_lang = None
    for lang in languages:
        lang_taxs.append(NEW_LANG_LINE.format(lang))

    with open(file_path) as fp:
        for line in fp:
            if line.find(CATEGORYINFOS_LINE) != -1:
                output_file.write(line)
                is_in_categoryinfos_part = True
                last_lang = None
                for lang in languages:
                    my_map[NEW_LANG_LINE.format(lang)] = None
            elif line.strip() in lang_taxs:
                last_lang = line.strip()
                my_map[last_lang] = {}
                my_map[last_lang]['language'] = line
            elif last_lang is not None and line.find('jcr:primaryType') != -1:
                my_map[last_lang]['jcr:primaryType'] = line
            elif last_lang is not None and line.find('hippotaxonomy:description') != -1:
                my_map[last_lang]['hippotaxonomy:description'] = line
            elif last_lang is not None and line.find('hippotaxonomy:name') != -1:
                my_map[last_lang]['hippotaxonomy:name'] = line
            elif last_lang is not None and line.find('hippotaxonomy:synonyms') != -1:
                my_map[last_lang]['hippotaxonomy:synonyms'] = line
            elif is_in_categoryinfos_part is True and \
                    line.find('jcr:primaryType') == -1 and \
                    line.find('hippotaxonomy:description') == -1 and \
                    line.find('hippotaxonomy:name') == -1 and \
                    line.find('hippotaxonomy:synonyms') == -1 and \
                    line.strip() not in lang_taxs:
                is_in_categoryinfos_part = False
                write_lang_lines(output_file, my_map)
            if not is_in_categoryinfos_part:
                output_file.write(line)
    write_lang_lines(output_file, my_map)
    os.remove(file_path)


def write_lang_lines(output_file, my_map):
    for index, (key, lang) in enumerate(my_map.items()):
        output_file.write(lang['language'])
        output_file.write(lang['jcr:primaryType'])
        if lang.get('hippotaxonomy:description') is not None:
            output_file.write(lang['hippotaxonomy:description'])
        if lang.get('hippotaxonomy:name') is not None:
            output_file.write(lang['hippotaxonomy:name'])
        if lang.get('hippotaxonomy:synonyms') is not None:
            output_file.write(lang['hippotaxonomy:synonyms'])


def validate_file(file_path):
    if not os.path.isfile(file_path):
        print("File path {} does not exist. Exiting...".format(file_path))
        sys.exit()


if __name__ == '__main__':
    file_path = sys.argv[1]
    new_languages = sys.argv[2]
    new_languages = new_languages.split(',')
    validate_file(file_path)
    output_file_path = add_lang_in_new_file(file_path, new_languages[0])
    for index in range(1, len(new_languages)):
        tmp_file = output_file_path
        output_file_path = add_lang_in_new_file(output_file_path, new_languages[index])
        os.remove(tmp_file)
    languages = ['en'] + new_languages
    remove_duplicates(output_file_path, languages)
