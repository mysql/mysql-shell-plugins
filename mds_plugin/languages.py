# Copyright (c) 2024, Oracle and/or its affiliates.

from enum import Enum

class GenerativeAILanguage(str, Enum):
    """
    ISO-639-1 Language codes
    """

    Abkhaz = "ab"
    Afar = "aa"
    Afrikaans = "af"
    Akan = "ak"
    Albanian = "sq"
    Amharic = "am"
    Arabic = "ar"
    Aragonese = "an"
    Armenian = "hy"
    Assamese = "as"
    Avaric = "av"
    Avestan = "ae"
    Aymara = "ay"
    Azerbaijani = "az"
    Bambara = "bm"
    Bashkir = "ba"
    Basque = "eu"
    Belarusian = "be"
    Bengali = "bn"
    Bihari = "bh"
    Bislama = "bi"
    Bosnian = "bs"
    Breton = "br"
    Bulgarian = "bg"
    Burmese = "my"
    Catalan = "ca"
    Chamorro = "ch"
    Chechen = "ce"
    Nyanja = "ny"
    Chinese = "zh"
    Chuvash = "cv"
    Cornish = "kw"
    Corsican = "co"
    Cree = "cr"
    Croatian = "hr"
    Czech = "cs"
    Danish = "da"
    Divehi = "dv"
    Dutch = "nl"
    Dzongkha = "dz"
    English = "en"
    Esperanto = "eo"
    Estonian = "et"
    Ewe = "ee"
    Faroese = "fo"
    Fijian = "fj"
    Finnish = "fi"
    French = "fr"
    Fula = "ff"
    Galician = "gl"
    Georgian = "ka"
    German = "de"
    Greek, Modern = "el"
    Guaraní = "gn"
    Gujarati = "gu"
    Haitian = "ht"
    Hausa = "ha"
    Hebrew = "he"
    Herero = "hz"
    Hindi = "hi"
    Hiri_Motu = "ho"
    Hungarian = "hu"
    Interlingua = "ia"
    Indonesian = "id"
    Interlingue = "ie"
    Irish = "ga"
    Igbo = "ig"
    Inupiaq = "ik"
    Ido = "io"
    Icelandic = "is"
    Italian = "it"
    Inuktitut = "iu"
    Japanese = "ja"
    Javanese = "jv"
    Kalaallisut = "kl"
    Kannada = "kn"
    Kanuri = "kr"
    Kashmiri = "ks"
    Kazakh = "kk"
    Khmer = "km"
    Kikuyu, Gikuyu = "ki"
    Kinyarwanda = "rw"
    Kirghiz, Kyrgyz = "ky"
    Komi = "kv"
    Kongo = "kg"
    Korean = "ko"
    Kurdish = "ku"
    Kwanyama, Kuanyama = "kj"
    Latin = "la"
    Luxembourgish = "lb"
    Luganda = "lg"
    Limburgish = "li"
    Lingala = "ln"
    Lao = "lo"
    Lithuanian = "lt"
    Luba_Katanga = "lu"
    Latvian = "lv"
    Manx = "gv"
    Macedonian = "mk"
    Malagasy = "mg"
    Malay = "ms"
    Malayalam = "ml"
    Maltese = "mt"
    Māori = "mi"
    Marathi = "mr"
    Marshallese = "mh"
    Mongolian = "mn"
    Nauru = "na"
    Navajo = "nv"
    Norwegian_Bokmål = "nb"
    North_Ndebele = "nd"
    Nepali = "ne"
    Ndonga = "ng"
    Norwegian_Nynorsk = "nn"
    Norwegian = "no"
    Nuosu = "ii"
    South_Ndebele = "nr"
    Occitan = "oc"
    Ojibwe = "oj"
    Old_Church_Slavonic = "cu"
    Oromo = "om"
    Oriya = "or"
    Ossetian = "os"
    Panjabi = "pa"
    Pāli = "pi"
    Persian = "fa"
    Polish = "pl"
    Pashto = "ps"
    Portuguese = "pt"
    Quechua = "qu"
    Romansh = "rm"
    Kirundi = "rn"
    Romanian = "ro"
    Russian = "ru"
    Sanskrit = "sa"
    Sardinian = "sc"
    Sindhi = "sd"
    Northern_Sami = "se"
    Samoan = "sm"
    Sango = "sg"
    Serbian = "sr"
    Scottish_Gaelic = "gd"
    Shona = "sn"
    Sinhala, Sinhalese = "si"
    Slovak = "sk"
    Slovene = "sl"
    Somali = "so"
    Southern_Sotho = "st"
    Spanish = "es"
    Sundanese = "su"
    Swahili = "sw"
    Swati = "ss"
    Swedish = "sv"
    Tamil = "ta"
    Telugu = "te"
    Tajik = "tg"
    Thai = "th"
    Tigrinya = "ti"
    Tibetan = "bo"
    Turkmen = "tk"
    Tagalog = "tl"
    Tswana = "tn"
    Tonga = "to"
    Turkish = "tr"
    Tsonga = "ts"
    Tatar = "tt"
    Twi = "tw"
    Tahitian = "ty"
    Uighur = "ug"
    Ukrainian = "uk"
    Urdu = "ur"
    Uzbek = "uz"
    Venda = "ve"
    Vietnamese = "vi"
    Volapük = "vo"
    Walloon = "wa"
    Welsh = "cy"
    Wolof = "wo"
    Western_Frisian = "fy"
    Xhosa = "xh"
    Yiddish = "yi"
    Yoruba = "yo"
    Zhuang = "za"
    Zulu = "zu"

    @classmethod
    def _missing_(cls, value):
        if value is None:
            return cls.English
        else:
            raise ValueError(f"Unsupported language: {value}")