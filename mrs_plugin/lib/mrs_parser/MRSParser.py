# Copyright (c) 2023, Oracle and/or its affiliates.
# encoding: utf-8
from antlr4 import *
from io import StringIO
import sys
if sys.version_info[1] > 5:
	from typing import TextIO
else:
	from typing.io import TextIO

def serializedATN():
    return [
        4,1,139,692,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,
        7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,
        13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
        20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,
        26,2,27,7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,
        33,7,33,2,34,7,34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,
        39,2,40,7,40,2,41,7,41,2,42,7,42,2,43,7,43,2,44,7,44,2,45,7,45,2,
        46,7,46,2,47,7,47,2,48,7,48,2,49,7,49,2,50,7,50,2,51,7,51,2,52,7,
        52,2,53,7,53,2,54,7,54,2,55,7,55,2,56,7,56,2,57,7,57,2,58,7,58,2,
        59,7,59,2,60,7,60,2,61,7,61,2,62,7,62,2,63,7,63,2,64,7,64,2,65,7,
        65,2,66,7,66,2,67,7,67,2,68,7,68,2,69,7,69,2,70,7,70,2,71,7,71,2,
        72,7,72,1,0,1,0,1,0,1,0,5,0,151,8,0,10,0,12,0,154,9,0,1,0,1,0,3,
        0,158,8,0,1,0,3,0,161,8,0,3,0,163,8,0,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3,1,180,8,1,1,2,1,2,1,3,1,3,3,
        3,186,8,3,1,4,1,4,1,4,1,5,1,5,1,5,1,6,1,6,3,6,196,8,6,1,6,1,6,1,
        7,1,7,1,7,1,7,1,7,1,8,1,8,1,9,1,9,1,9,3,9,210,8,9,1,9,1,9,1,9,1,
        10,1,10,1,10,1,10,3,10,219,8,10,1,11,1,11,1,11,4,11,224,8,11,11,
        11,12,11,225,1,12,1,12,1,12,3,12,231,8,12,1,13,1,13,1,13,3,13,236,
        8,13,1,13,1,13,1,13,1,13,3,13,242,8,13,1,14,1,14,1,14,1,14,1,14,
        1,14,4,14,250,8,14,11,14,12,14,251,1,15,1,15,1,15,1,15,1,15,1,15,
        1,15,1,15,1,15,3,15,263,8,15,1,16,1,16,1,16,1,16,1,16,5,16,270,8,
        16,10,16,12,16,273,9,16,1,17,1,17,1,17,1,18,1,18,1,18,1,19,1,19,
        1,19,1,20,1,20,1,20,1,20,1,21,1,21,1,21,1,21,1,21,3,21,293,8,21,
        1,22,1,22,1,22,3,22,298,8,22,1,22,1,22,1,22,3,22,303,8,22,1,22,1,
        22,3,22,307,8,22,1,22,3,22,310,8,22,1,22,1,22,1,22,3,22,315,8,22,
        1,23,1,23,1,23,1,23,1,23,4,23,322,8,23,11,23,12,23,323,1,24,1,24,
        1,24,3,24,329,8,24,1,24,1,24,3,24,333,8,24,1,24,3,24,336,8,24,1,
        24,3,24,339,8,24,1,24,1,24,1,24,3,24,344,8,24,1,24,1,24,1,24,3,24,
        349,8,24,1,24,1,24,1,24,3,24,354,8,24,1,24,1,24,1,25,1,25,1,25,1,
        25,1,25,1,25,1,25,1,25,4,25,366,8,25,11,25,12,25,367,1,26,1,26,1,
        26,1,26,3,26,374,8,26,1,27,1,27,1,27,1,28,1,28,1,28,1,28,1,29,1,
        29,1,29,3,29,386,8,29,1,29,1,29,1,29,1,29,3,29,392,8,29,1,29,1,29,
        1,29,1,29,1,29,1,29,1,29,5,29,401,8,29,10,29,12,29,404,9,29,1,30,
        1,30,1,30,1,30,1,31,1,31,1,31,1,31,1,31,1,32,1,32,1,32,1,32,1,32,
        1,32,3,32,421,8,32,1,32,3,32,424,8,32,1,33,1,33,1,33,3,33,429,8,
        33,1,33,3,33,432,8,33,1,33,3,33,435,8,33,1,33,1,33,1,33,3,33,440,
        8,33,1,34,1,34,1,34,1,34,1,34,3,34,447,8,34,1,35,1,35,1,35,1,35,
        1,36,1,36,1,36,1,36,3,36,457,8,36,1,36,1,36,3,36,461,8,36,1,37,1,
        37,1,37,3,37,466,8,37,1,37,1,37,1,38,1,38,1,38,1,38,1,39,1,39,1,
        39,1,39,1,39,3,39,479,8,39,1,39,3,39,482,8,39,1,40,1,40,1,40,3,40,
        487,8,40,1,40,3,40,490,8,40,1,40,3,40,493,8,40,1,40,1,40,1,40,3,
        40,498,8,40,1,41,1,41,1,41,1,41,1,41,3,41,505,8,41,1,42,3,42,508,
        8,42,1,42,1,42,1,43,1,43,1,44,1,44,1,45,1,45,1,46,1,46,1,47,1,47,
        1,48,1,48,1,49,1,49,1,50,1,50,1,51,1,51,1,52,1,52,1,53,1,53,1,53,
        5,53,535,8,53,10,53,12,53,538,9,53,1,54,1,54,1,54,1,54,1,55,1,55,
        3,55,546,8,55,1,56,1,56,1,56,3,56,551,8,56,3,56,553,8,56,1,57,1,
        57,1,57,1,58,1,58,1,58,5,58,561,8,58,10,58,12,58,564,9,58,3,58,566,
        8,58,1,59,1,59,1,59,3,59,571,8,59,1,60,1,60,1,60,1,60,3,60,577,8,
        60,1,61,1,61,1,62,1,62,1,62,1,62,5,62,585,8,62,10,62,12,62,588,9,
        62,1,62,1,62,1,62,1,62,3,62,594,8,62,1,63,1,63,1,63,1,63,1,64,1,
        64,1,64,1,64,5,64,604,8,64,10,64,12,64,607,9,64,1,64,1,64,1,64,1,
        64,3,64,613,8,64,1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,3,
        65,624,8,65,1,66,1,66,1,66,1,66,5,66,630,8,66,10,66,12,66,633,9,
        66,1,66,1,66,1,66,1,66,3,66,639,8,66,1,67,4,67,642,8,67,11,67,12,
        67,643,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,
        68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,1,68,3,68,668,8,
        68,1,68,3,68,671,8,68,1,69,1,69,1,69,3,69,676,8,69,1,70,1,70,1,70,
        3,70,681,8,70,1,71,1,71,1,71,3,71,686,8,71,1,72,1,72,3,72,690,8,
        72,1,72,0,0,73,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,
        36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,
        80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,110,112,114,116,
        118,120,122,124,126,128,130,132,134,136,138,140,142,144,0,7,1,0,
        33,34,2,0,58,58,62,63,1,0,17,18,2,0,128,128,130,130,1,0,131,132,
        2,0,131,131,136,136,2,0,69,69,76,82,749,0,162,1,0,0,0,2,179,1,0,
        0,0,4,181,1,0,0,0,6,185,1,0,0,0,8,187,1,0,0,0,10,190,1,0,0,0,12,
        193,1,0,0,0,14,199,1,0,0,0,16,204,1,0,0,0,18,206,1,0,0,0,20,214,
        1,0,0,0,22,223,1,0,0,0,24,227,1,0,0,0,26,232,1,0,0,0,28,249,1,0,
        0,0,30,253,1,0,0,0,32,264,1,0,0,0,34,274,1,0,0,0,36,277,1,0,0,0,
        38,280,1,0,0,0,40,283,1,0,0,0,42,287,1,0,0,0,44,294,1,0,0,0,46,321,
        1,0,0,0,48,325,1,0,0,0,50,365,1,0,0,0,52,369,1,0,0,0,54,375,1,0,
        0,0,56,378,1,0,0,0,58,382,1,0,0,0,60,405,1,0,0,0,62,409,1,0,0,0,
        64,414,1,0,0,0,66,425,1,0,0,0,68,441,1,0,0,0,70,448,1,0,0,0,72,460,
        1,0,0,0,74,462,1,0,0,0,76,469,1,0,0,0,78,473,1,0,0,0,80,483,1,0,
        0,0,82,499,1,0,0,0,84,507,1,0,0,0,86,511,1,0,0,0,88,513,1,0,0,0,
        90,515,1,0,0,0,92,517,1,0,0,0,94,519,1,0,0,0,96,521,1,0,0,0,98,523,
        1,0,0,0,100,525,1,0,0,0,102,527,1,0,0,0,104,529,1,0,0,0,106,531,
        1,0,0,0,108,539,1,0,0,0,110,543,1,0,0,0,112,547,1,0,0,0,114,554,
        1,0,0,0,116,565,1,0,0,0,118,567,1,0,0,0,120,572,1,0,0,0,122,578,
        1,0,0,0,124,593,1,0,0,0,126,595,1,0,0,0,128,612,1,0,0,0,130,623,
        1,0,0,0,132,638,1,0,0,0,134,641,1,0,0,0,136,645,1,0,0,0,138,675,
        1,0,0,0,140,680,1,0,0,0,142,685,1,0,0,0,144,689,1,0,0,0,146,163,
        5,0,0,1,147,152,3,2,1,0,148,149,5,107,0,0,149,151,3,2,1,0,150,148,
        1,0,0,0,151,154,1,0,0,0,152,150,1,0,0,0,152,153,1,0,0,0,153,160,
        1,0,0,0,154,152,1,0,0,0,155,157,5,107,0,0,156,158,5,0,0,1,157,156,
        1,0,0,0,157,158,1,0,0,0,158,161,1,0,0,0,159,161,5,0,0,1,160,155,
        1,0,0,0,160,159,1,0,0,0,161,163,1,0,0,0,162,146,1,0,0,0,162,147,
        1,0,0,0,163,1,1,0,0,0,164,180,3,20,10,0,165,180,3,26,13,0,166,180,
        3,44,22,0,167,180,3,48,24,0,168,180,3,58,29,0,169,180,3,62,31,0,
        170,180,3,64,32,0,171,180,3,66,33,0,172,180,3,68,34,0,173,180,3,
        70,35,0,174,180,3,74,37,0,175,180,3,76,38,0,176,180,3,78,39,0,177,
        180,3,80,40,0,178,180,3,82,41,0,179,164,1,0,0,0,179,165,1,0,0,0,
        179,166,1,0,0,0,179,167,1,0,0,0,179,168,1,0,0,0,179,169,1,0,0,0,
        179,170,1,0,0,0,179,171,1,0,0,0,179,172,1,0,0,0,179,173,1,0,0,0,
        179,174,1,0,0,0,179,175,1,0,0,0,179,176,1,0,0,0,179,177,1,0,0,0,
        179,178,1,0,0,0,180,3,1,0,0,0,181,182,7,0,0,0,182,5,1,0,0,0,183,
        186,3,122,61,0,184,186,5,44,0,0,185,183,1,0,0,0,185,184,1,0,0,0,
        186,7,1,0,0,0,187,188,5,47,0,0,188,189,3,130,65,0,189,9,1,0,0,0,
        190,191,5,39,0,0,191,192,3,122,61,0,192,11,1,0,0,0,193,195,5,40,
        0,0,194,196,5,50,0,0,195,194,1,0,0,0,195,196,1,0,0,0,196,197,1,0,
        0,0,197,198,5,52,0,0,198,13,1,0,0,0,199,200,5,53,0,0,200,201,5,54,
        0,0,201,202,5,55,0,0,202,203,3,16,8,0,203,15,1,0,0,0,204,205,5,123,
        0,0,205,17,1,0,0,0,206,209,5,16,0,0,207,208,5,15,0,0,208,210,3,84,
        42,0,209,207,1,0,0,0,209,210,1,0,0,0,210,211,1,0,0,0,211,212,5,20,
        0,0,212,213,3,88,44,0,213,19,1,0,0,0,214,215,5,6,0,0,215,216,5,11,
        0,0,216,218,5,12,0,0,217,219,3,22,11,0,218,217,1,0,0,0,218,219,1,
        0,0,0,219,21,1,0,0,0,220,224,3,4,2,0,221,224,3,8,4,0,222,224,3,24,
        12,0,223,220,1,0,0,0,223,221,1,0,0,0,223,222,1,0,0,0,224,225,1,0,
        0,0,225,223,1,0,0,0,225,226,1,0,0,0,226,23,1,0,0,0,227,230,5,64,
        0,0,228,229,5,48,0,0,229,231,5,49,0,0,230,228,1,0,0,0,230,231,1,
        0,0,0,231,25,1,0,0,0,232,235,5,7,0,0,233,234,5,8,0,0,234,236,5,9,
        0,0,235,233,1,0,0,0,235,236,1,0,0,0,236,237,1,0,0,0,237,238,5,11,
        0,0,238,239,5,15,0,0,239,241,3,84,42,0,240,242,3,28,14,0,241,240,
        1,0,0,0,241,242,1,0,0,0,242,27,1,0,0,0,243,250,3,4,2,0,244,250,3,
        30,15,0,245,250,3,32,16,0,246,250,3,42,21,0,247,250,3,8,4,0,248,
        250,3,10,5,0,249,243,1,0,0,0,249,244,1,0,0,0,249,245,1,0,0,0,249,
        246,1,0,0,0,249,247,1,0,0,0,249,248,1,0,0,0,250,251,1,0,0,0,251,
        249,1,0,0,0,251,252,1,0,0,0,252,29,1,0,0,0,253,262,5,35,0,0,254,
        263,5,36,0,0,255,263,5,37,0,0,256,257,5,36,0,0,257,258,5,106,0,0,
        258,263,5,37,0,0,259,260,5,37,0,0,260,261,5,106,0,0,261,263,5,36,
        0,0,262,254,1,0,0,0,262,255,1,0,0,0,262,256,1,0,0,0,262,259,1,0,
        0,0,263,31,1,0,0,0,264,271,5,40,0,0,265,270,3,34,17,0,266,270,3,
        36,18,0,267,270,3,38,19,0,268,270,3,40,20,0,269,265,1,0,0,0,269,
        266,1,0,0,0,269,267,1,0,0,0,269,268,1,0,0,0,270,273,1,0,0,0,271,
        269,1,0,0,0,271,272,1,0,0,0,272,33,1,0,0,0,273,271,1,0,0,0,274,275,
        5,41,0,0,275,276,3,6,3,0,276,35,1,0,0,0,277,278,5,42,0,0,278,279,
        3,6,3,0,279,37,1,0,0,0,280,281,5,43,0,0,281,282,3,6,3,0,282,39,1,
        0,0,0,283,284,5,55,0,0,284,285,5,56,0,0,285,286,3,6,3,0,286,41,1,
        0,0,0,287,288,5,45,0,0,288,289,5,46,0,0,289,292,5,20,0,0,290,293,
        3,86,43,0,291,293,5,44,0,0,292,290,1,0,0,0,292,291,1,0,0,0,293,43,
        1,0,0,0,294,297,5,7,0,0,295,296,5,8,0,0,296,298,5,9,0,0,297,295,
        1,0,0,0,297,298,1,0,0,0,298,299,1,0,0,0,299,300,5,11,0,0,300,302,
        5,20,0,0,301,303,3,88,44,0,302,301,1,0,0,0,302,303,1,0,0,0,303,309,
        1,0,0,0,304,306,5,16,0,0,305,307,5,15,0,0,306,305,1,0,0,0,306,307,
        1,0,0,0,307,308,1,0,0,0,308,310,3,84,42,0,309,304,1,0,0,0,309,310,
        1,0,0,0,310,311,1,0,0,0,311,312,5,17,0,0,312,314,3,86,43,0,313,315,
        3,46,23,0,314,313,1,0,0,0,314,315,1,0,0,0,315,45,1,0,0,0,316,322,
        3,4,2,0,317,322,3,12,6,0,318,322,3,14,7,0,319,322,3,8,4,0,320,322,
        3,10,5,0,321,316,1,0,0,0,321,317,1,0,0,0,321,318,1,0,0,0,321,319,
        1,0,0,0,321,320,1,0,0,0,322,323,1,0,0,0,323,321,1,0,0,0,323,324,
        1,0,0,0,324,47,1,0,0,0,325,328,5,7,0,0,326,327,5,8,0,0,327,329,5,
        9,0,0,328,326,1,0,0,0,328,329,1,0,0,0,329,330,1,0,0,0,330,332,5,
        11,0,0,331,333,5,22,0,0,332,331,1,0,0,0,332,333,1,0,0,0,333,335,
        1,0,0,0,334,336,5,21,0,0,335,334,1,0,0,0,335,336,1,0,0,0,336,338,
        1,0,0,0,337,339,5,23,0,0,338,337,1,0,0,0,338,339,1,0,0,0,339,340,
        1,0,0,0,340,341,5,25,0,0,341,343,3,92,46,0,342,344,3,18,9,0,343,
        342,1,0,0,0,343,344,1,0,0,0,344,345,1,0,0,0,345,346,5,17,0,0,346,
        348,3,110,55,0,347,349,3,50,25,0,348,347,1,0,0,0,348,349,1,0,0,0,
        349,350,1,0,0,0,350,351,5,32,0,0,351,353,3,94,47,0,352,354,3,134,
        67,0,353,352,1,0,0,0,353,354,1,0,0,0,354,355,1,0,0,0,355,356,3,132,
        66,0,356,49,1,0,0,0,357,366,3,4,2,0,358,366,3,12,6,0,359,366,3,14,
        7,0,360,366,3,8,4,0,361,366,3,10,5,0,362,366,3,52,26,0,363,366,3,
        54,27,0,364,366,3,56,28,0,365,357,1,0,0,0,365,358,1,0,0,0,365,359,
        1,0,0,0,365,360,1,0,0,0,365,361,1,0,0,0,365,362,1,0,0,0,365,363,
        1,0,0,0,365,364,1,0,0,0,366,367,1,0,0,0,367,365,1,0,0,0,367,368,
        1,0,0,0,368,51,1,0,0,0,369,370,5,58,0,0,370,373,5,59,0,0,371,374,
        3,122,61,0,372,374,5,60,0,0,373,371,1,0,0,0,373,372,1,0,0,0,374,
        53,1,0,0,0,375,376,5,61,0,0,376,377,7,1,0,0,377,55,1,0,0,0,378,379,
        5,40,0,0,379,380,5,27,0,0,380,381,3,110,55,0,381,57,1,0,0,0,382,
        385,5,7,0,0,383,384,5,8,0,0,384,386,5,9,0,0,385,383,1,0,0,0,385,
        386,1,0,0,0,386,387,1,0,0,0,387,388,5,11,0,0,388,389,5,27,0,0,389,
        391,3,100,50,0,390,392,3,18,9,0,391,390,1,0,0,0,391,392,1,0,0,0,
        392,393,1,0,0,0,393,394,5,17,0,0,394,395,3,110,55,0,395,396,5,32,
        0,0,396,397,3,94,47,0,397,398,5,28,0,0,398,402,3,132,66,0,399,401,
        3,60,30,0,400,399,1,0,0,0,401,404,1,0,0,0,402,400,1,0,0,0,402,403,
        1,0,0,0,403,59,1,0,0,0,404,402,1,0,0,0,405,406,5,29,0,0,406,407,
        3,96,48,0,407,408,3,132,66,0,408,61,1,0,0,0,409,410,5,30,0,0,410,
        411,5,11,0,0,411,412,5,15,0,0,412,413,3,84,42,0,413,63,1,0,0,0,414,
        415,5,30,0,0,415,416,5,11,0,0,416,417,5,20,0,0,417,423,3,88,44,0,
        418,420,5,16,0,0,419,421,5,15,0,0,420,419,1,0,0,0,420,421,1,0,0,
        0,421,422,1,0,0,0,422,424,3,84,42,0,423,418,1,0,0,0,423,424,1,0,
        0,0,424,65,1,0,0,0,425,426,5,30,0,0,426,428,5,11,0,0,427,429,5,22,
        0,0,428,427,1,0,0,0,428,429,1,0,0,0,429,431,1,0,0,0,430,432,5,21,
        0,0,431,430,1,0,0,0,431,432,1,0,0,0,432,434,1,0,0,0,433,435,5,23,
        0,0,434,433,1,0,0,0,434,435,1,0,0,0,435,436,1,0,0,0,436,437,5,25,
        0,0,437,439,3,92,46,0,438,440,3,18,9,0,439,438,1,0,0,0,439,440,1,
        0,0,0,440,67,1,0,0,0,441,442,5,30,0,0,442,443,5,11,0,0,443,444,5,
        27,0,0,444,446,3,100,50,0,445,447,3,18,9,0,446,445,1,0,0,0,446,447,
        1,0,0,0,447,69,1,0,0,0,448,449,5,31,0,0,449,450,5,11,0,0,450,451,
        3,72,36,0,451,71,1,0,0,0,452,453,5,15,0,0,453,461,3,84,42,0,454,
        455,5,15,0,0,455,457,3,84,42,0,456,454,1,0,0,0,456,457,1,0,0,0,457,
        458,1,0,0,0,458,459,5,20,0,0,459,461,3,88,44,0,460,452,1,0,0,0,460,
        456,1,0,0,0,461,73,1,0,0,0,462,463,5,10,0,0,463,465,5,11,0,0,464,
        466,5,12,0,0,465,464,1,0,0,0,465,466,1,0,0,0,466,467,1,0,0,0,467,
        468,5,13,0,0,468,75,1,0,0,0,469,470,5,10,0,0,470,471,5,11,0,0,471,
        472,5,14,0,0,472,77,1,0,0,0,473,474,5,10,0,0,474,475,5,11,0,0,475,
        481,5,19,0,0,476,478,7,2,0,0,477,479,5,15,0,0,478,477,1,0,0,0,478,
        479,1,0,0,0,479,480,1,0,0,0,480,482,3,84,42,0,481,476,1,0,0,0,481,
        482,1,0,0,0,482,79,1,0,0,0,483,484,5,10,0,0,484,486,5,11,0,0,485,
        487,5,22,0,0,486,485,1,0,0,0,486,487,1,0,0,0,487,489,1,0,0,0,488,
        490,5,21,0,0,489,488,1,0,0,0,489,490,1,0,0,0,490,492,1,0,0,0,491,
        493,5,23,0,0,492,491,1,0,0,0,492,493,1,0,0,0,493,494,1,0,0,0,494,
        497,5,24,0,0,495,496,7,2,0,0,496,498,3,72,36,0,497,495,1,0,0,0,497,
        498,1,0,0,0,498,81,1,0,0,0,499,500,5,10,0,0,500,501,5,11,0,0,501,
        504,5,26,0,0,502,503,7,2,0,0,503,505,3,72,36,0,504,502,1,0,0,0,504,
        505,1,0,0,0,505,83,1,0,0,0,506,508,3,118,59,0,507,506,1,0,0,0,507,
        508,1,0,0,0,508,509,1,0,0,0,509,510,3,120,60,0,510,85,1,0,0,0,511,
        512,3,104,52,0,512,87,1,0,0,0,513,514,3,120,60,0,514,89,1,0,0,0,
        515,516,3,104,52,0,516,91,1,0,0,0,517,518,3,120,60,0,518,93,1,0,
        0,0,519,520,3,104,52,0,520,95,1,0,0,0,521,522,3,104,52,0,522,97,
        1,0,0,0,523,524,3,104,52,0,524,99,1,0,0,0,525,526,3,120,60,0,526,
        101,1,0,0,0,527,528,7,3,0,0,528,103,1,0,0,0,529,530,3,102,51,0,530,
        105,1,0,0,0,531,536,3,104,52,0,532,533,5,106,0,0,533,535,3,104,52,
        0,534,532,1,0,0,0,535,538,1,0,0,0,536,534,1,0,0,0,536,537,1,0,0,
        0,537,107,1,0,0,0,538,536,1,0,0,0,539,540,5,109,0,0,540,541,3,106,
        53,0,541,542,5,110,0,0,542,109,1,0,0,0,543,545,3,104,52,0,544,546,
        3,114,57,0,545,544,1,0,0,0,545,546,1,0,0,0,546,111,1,0,0,0,547,552,
        3,104,52,0,548,550,3,114,57,0,549,551,3,114,57,0,550,549,1,0,0,0,
        550,551,1,0,0,0,551,553,1,0,0,0,552,548,1,0,0,0,552,553,1,0,0,0,
        553,113,1,0,0,0,554,555,5,105,0,0,555,556,3,104,52,0,556,115,1,0,
        0,0,557,566,3,112,56,0,558,562,3,104,52,0,559,561,3,114,57,0,560,
        559,1,0,0,0,561,564,1,0,0,0,562,560,1,0,0,0,562,563,1,0,0,0,563,
        566,1,0,0,0,564,562,1,0,0,0,565,557,1,0,0,0,565,558,1,0,0,0,566,
        117,1,0,0,0,567,570,3,116,58,0,568,569,5,108,0,0,569,571,5,123,0,
        0,570,568,1,0,0,0,570,571,1,0,0,0,571,119,1,0,0,0,572,573,5,94,0,
        0,573,576,3,116,58,0,574,575,5,94,0,0,575,577,3,116,58,0,576,574,
        1,0,0,0,576,577,1,0,0,0,577,121,1,0,0,0,578,579,7,4,0,0,579,123,
        1,0,0,0,580,581,5,111,0,0,581,586,3,126,63,0,582,583,5,106,0,0,583,
        585,3,126,63,0,584,582,1,0,0,0,585,588,1,0,0,0,586,584,1,0,0,0,586,
        587,1,0,0,0,587,589,1,0,0,0,588,586,1,0,0,0,589,590,5,112,0,0,590,
        594,1,0,0,0,591,592,5,111,0,0,592,594,5,112,0,0,593,580,1,0,0,0,
        593,591,1,0,0,0,594,125,1,0,0,0,595,596,7,5,0,0,596,597,5,108,0,
        0,597,598,3,130,65,0,598,127,1,0,0,0,599,600,5,1,0,0,600,605,3,130,
        65,0,601,602,5,106,0,0,602,604,3,130,65,0,603,601,1,0,0,0,604,607,
        1,0,0,0,605,603,1,0,0,0,605,606,1,0,0,0,606,608,1,0,0,0,607,605,
        1,0,0,0,608,609,5,2,0,0,609,613,1,0,0,0,610,611,5,1,0,0,611,613,
        5,2,0,0,612,599,1,0,0,0,612,610,1,0,0,0,613,129,1,0,0,0,614,624,
        5,136,0,0,615,624,5,131,0,0,616,624,5,137,0,0,617,624,5,123,0,0,
        618,624,3,124,62,0,619,624,3,128,64,0,620,624,5,3,0,0,621,624,5,
        4,0,0,622,624,5,5,0,0,623,614,1,0,0,0,623,615,1,0,0,0,623,616,1,
        0,0,0,623,617,1,0,0,0,623,618,1,0,0,0,623,619,1,0,0,0,623,620,1,
        0,0,0,623,621,1,0,0,0,623,622,1,0,0,0,624,131,1,0,0,0,625,626,5,
        111,0,0,626,631,3,136,68,0,627,628,5,106,0,0,628,630,3,136,68,0,
        629,627,1,0,0,0,630,633,1,0,0,0,631,629,1,0,0,0,631,632,1,0,0,0,
        632,634,1,0,0,0,633,631,1,0,0,0,634,635,5,112,0,0,635,639,1,0,0,
        0,636,637,5,111,0,0,637,639,5,112,0,0,638,625,1,0,0,0,638,636,1,
        0,0,0,639,133,1,0,0,0,640,642,7,6,0,0,641,640,1,0,0,0,642,643,1,
        0,0,0,643,641,1,0,0,0,643,644,1,0,0,0,644,135,1,0,0,0,645,646,3,
        138,69,0,646,647,5,108,0,0,647,667,3,110,55,0,648,668,5,66,0,0,649,
        668,5,67,0,0,650,668,5,65,0,0,651,668,5,68,0,0,652,668,5,70,0,0,
        653,668,5,71,0,0,654,668,5,72,0,0,655,668,5,73,0,0,656,657,5,74,
        0,0,657,658,5,109,0,0,658,659,3,140,70,0,659,660,5,110,0,0,660,668,
        1,0,0,0,661,662,5,75,0,0,662,663,5,109,0,0,663,664,3,142,71,0,664,
        665,5,110,0,0,665,668,1,0,0,0,666,668,3,134,67,0,667,648,1,0,0,0,
        667,649,1,0,0,0,667,650,1,0,0,0,667,651,1,0,0,0,667,652,1,0,0,0,
        667,653,1,0,0,0,667,654,1,0,0,0,667,655,1,0,0,0,667,656,1,0,0,0,
        667,661,1,0,0,0,667,666,1,0,0,0,667,668,1,0,0,0,668,670,1,0,0,0,
        669,671,3,132,66,0,670,669,1,0,0,0,670,671,1,0,0,0,671,137,1,0,0,
        0,672,676,5,136,0,0,673,676,5,131,0,0,674,676,3,104,52,0,675,672,
        1,0,0,0,675,673,1,0,0,0,675,674,1,0,0,0,676,139,1,0,0,0,677,681,
        5,136,0,0,678,681,5,131,0,0,679,681,3,104,52,0,680,677,1,0,0,0,680,
        678,1,0,0,0,680,679,1,0,0,0,681,141,1,0,0,0,682,686,5,136,0,0,683,
        686,5,131,0,0,684,686,3,104,52,0,685,682,1,0,0,0,685,683,1,0,0,0,
        685,684,1,0,0,0,686,143,1,0,0,0,687,690,3,110,55,0,688,690,3,132,
        66,0,689,687,1,0,0,0,689,688,1,0,0,0,690,145,1,0,0,0,80,152,157,
        160,162,179,185,195,209,218,223,225,230,235,241,249,251,262,269,
        271,292,297,302,306,309,314,321,323,328,332,335,338,343,348,353,
        365,367,373,385,391,402,420,423,428,431,434,439,446,456,460,465,
        478,481,486,489,492,497,504,507,536,545,550,552,562,565,570,576,
        586,593,605,612,623,631,638,643,667,670,675,680,685,689
    ]

class MRSParser ( Parser ):

    grammarFileName = "MRS.g4"

    atn = ATNDeserializer().deserialize(serializedATN())

    decisionsToDFA = [ DFA(ds, i) for i, ds in enumerate(atn.decisionToState) ]

    sharedContextCache = PredictionContextCache()

    literalNames = [ "<INVALID>", "'['", "']'", "'true'", "'false'", "'null'", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "'='", "':='", "'<=>'", "'>='", "'>'", 
                     "'<='", "'<'", "'!='", "'+'", "'-'", "'*'", "'/'", 
                     "'%'", "'!'", "'~'", "'<<'", "'>>'", "'&&'", "'&'", 
                     "'^'", "'||'", "'|'", "'.'", "','", "';'", "':'", "'('", 
                     "')'", "'{'", "'}'", "'_'", "'->'", "'->>'", "'@'", 
                     "<INVALID>", "'@@'", "'\\N'", "'?'", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                     "'<>'" ]

    symbolicNames = [ "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                      "<INVALID>", "<INVALID>", "CONFIGURE_SYMBOL", "CREATE_SYMBOL", 
                      "OR_SYMBOL", "REPLACE_SYMBOL", "SHOW_SYMBOL", "REST_SYMBOL", 
                      "METADATA_SYMBOL", "STATUS_SYMBOL", "SERVICES_SYMBOL", 
                      "SERVICE_SYMBOL", "ON_SYMBOL", "FROM_SYMBOL", "IN_SYMBOL", 
                      "SCHEMAS_SYMBOL", "SCHEMA_SYMBOL", "JSON_SYMBOL", 
                      "RELATIONAL_SYMBOL", "DUALITY_SYMBOL", "VIEWS_SYMBOL", 
                      "VIEW_SYMBOL", "PROCEDURES_SYMBOL", "PROCEDURE_SYMBOL", 
                      "PARAMETERS_SYMBOL", "RESULT_SYMBOL", "DROP_SYMBOL", 
                      "USE_SYMBOL", "AS_SYMBOL", "ENABLED_SYMBOL", "DISABLED_SYMBOL", 
                      "PROTOCOL_SYMBOL", "HTTP_SYMBOL", "HTTPS_SYMBOL", 
                      "FILTER_SYMBOL", "COMMENTS_SYMBOL", "AUTHENTICATION_SYMBOL", 
                      "PATH_SYMBOL", "REDIRECTION_SYMBOL", "VALIDATION_SYMBOL", 
                      "DEFAULT_SYMBOL", "USER_SYMBOL", "MANAGEMENT_SYMBOL", 
                      "OPTIONS_SYMBOL", "IF_SYMBOL", "AVAILABLE_SYMBOL", 
                      "NOT_SYMBOL", "EXISTS_SYMBOL", "REQUIRED_SYMBOL", 
                      "ITEMS_SYMBOL", "PER_SYMBOL", "PAGE_SYMBOL", "CONTENT_SYMBOL", 
                      "HOST_SYMBOL", "MEDIA_SYMBOL", "TYPE_SYMBOL", "AUTODETECT_SYMBOL", 
                      "FORMAT_SYMBOL", "FEED_SYMBOL", "ITEM_SYMBOL", "UPDATE_SYMBOL", 
                      "AT_INOUT_SYMBOL", "AT_IN_SYMBOL", "AT_OUT_SYMBOL", 
                      "AT_NOCHECK_SYMBOL", "AT_NOUPDATE_SYMBOL", "AT_SORTABLE_SYMBOL", 
                      "AT_NOFILTERING_SYMBOL", "AT_ROWOWNERSHIP_SYMBOL", 
                      "AT_UNNEST_SYMBOL", "AT_REDUCETO_SYMBOL", "AT_DATATYPE_SYMBOL", 
                      "AT_SELECT_SYMBOL", "AT_NOSELECT_SYMBOL", "AT_INSERT_SYMBOL", 
                      "AT_NOINSERT_SYMBOL", "AT_UPDATE_SYMBOL", "AT_DELETE_SYMBOL", 
                      "AT_NODELETE_SYMBOL", "EQUAL_OPERATOR", "ASSIGN_OPERATOR", 
                      "NULL_SAFE_EQUAL_OPERATOR", "GREATER_OR_EQUAL_OPERATOR", 
                      "GREATER_THAN_OPERATOR", "LESS_OR_EQUAL_OPERATOR", 
                      "LESS_THAN_OPERATOR", "NOT_EQUAL_OPERATOR", "PLUS_OPERATOR", 
                      "MINUS_OPERATOR", "MULT_OPERATOR", "DIV_OPERATOR", 
                      "MOD_OPERATOR", "LOGICAL_NOT_OPERATOR", "BITWISE_NOT_OPERATOR", 
                      "SHIFT_LEFT_OPERATOR", "SHIFT_RIGHT_OPERATOR", "LOGICAL_AND_OPERATOR", 
                      "BITWISE_AND_OPERATOR", "BITWISE_XOR_OPERATOR", "LOGICAL_OR_OPERATOR", 
                      "BITWISE_OR_OPERATOR", "DOT_SYMBOL", "COMMA_SYMBOL", 
                      "SEMICOLON_SYMBOL", "COLON_SYMBOL", "OPEN_PAR_SYMBOL", 
                      "CLOSE_PAR_SYMBOL", "OPEN_CURLY_SYMBOL", "CLOSE_CURLY_SYMBOL", 
                      "UNDERLINE_SYMBOL", "JSON_SEPARATOR_SYMBOL", "JSON_UNQUOTED_SEPARATOR_SYMBOL", 
                      "AT_SIGN_SYMBOL", "AT_TEXT_SUFFIX", "AT_AT_SIGN_SYMBOL", 
                      "NULL2_SYMBOL", "PARAM_MARKER", "HEX_NUMBER", "BIN_NUMBER", 
                      "INT_NUMBER", "DECIMAL_NUMBER", "FLOAT_NUMBER", "WHITESPACE", 
                      "INVALID_INPUT", "IDENTIFIER", "NCHAR_TEXT", "BACK_TICK_QUOTED_ID", 
                      "DOUBLE_QUOTED_TEXT", "SINGLE_QUOTED_TEXT", "BLOCK_COMMENT", 
                      "POUND_COMMENT", "DASHDASH_COMMENT", "JSON_STRING", 
                      "JSON_NUMBER", "WS", "NOT_EQUAL2_OPERATOR" ]

    RULE_mrsScript = 0
    RULE_mrsStatement = 1
    RULE_enabledDisabled = 2
    RULE_quotedTextOrDefault = 3
    RULE_jsonOptions = 4
    RULE_comments = 5
    RULE_authenticationRequired = 6
    RULE_itemsPerPage = 7
    RULE_itemsPerPageNumber = 8
    RULE_serviceSchemaSelector = 9
    RULE_configureRestMetadataStatement = 10
    RULE_restMetadataOptions = 11
    RULE_updateIfAvailable = 12
    RULE_createRestServiceStatement = 13
    RULE_restServiceOptions = 14
    RULE_restProtocol = 15
    RULE_restAuthentication = 16
    RULE_authPath = 17
    RULE_authRedirection = 18
    RULE_authValidation = 19
    RULE_authPageContent = 20
    RULE_userManagementSchema = 21
    RULE_createRestSchemaStatement = 22
    RULE_restSchemaOptions = 23
    RULE_createRestViewStatement = 24
    RULE_restDualityViewOptions = 25
    RULE_restViewMediaType = 26
    RULE_restViewFormat = 27
    RULE_restViewAuthenticationProcedure = 28
    RULE_createRestProcedureStatement = 29
    RULE_restProcedureResult = 30
    RULE_dropRestServiceStatement = 31
    RULE_dropRestSchemaStatement = 32
    RULE_dropRestDualityViewStatement = 33
    RULE_dropRestProcedureStatement = 34
    RULE_useStatement = 35
    RULE_serviceAndSchemaRequestPaths = 36
    RULE_showRestMetadataStatusStatement = 37
    RULE_showRestServicesStatement = 38
    RULE_showRestSchemasStatement = 39
    RULE_showRestViewsStatement = 40
    RULE_showRestProceduresStatement = 41
    RULE_serviceRequestPath = 42
    RULE_schemaName = 43
    RULE_schemaRequestPath = 44
    RULE_viewName = 45
    RULE_viewRequestPath = 46
    RULE_restObjectName = 47
    RULE_restResultName = 48
    RULE_procedureName = 49
    RULE_procedureRequestPath = 50
    RULE_pureIdentifier = 51
    RULE_identifier = 52
    RULE_identifierList = 53
    RULE_identifierListWithParentheses = 54
    RULE_qualifiedIdentifier = 55
    RULE_simpleIdentifier = 56
    RULE_dotIdentifier = 57
    RULE_dottedIdentifier = 58
    RULE_hostAndPortIdentifier = 59
    RULE_requestPathIdentifier = 60
    RULE_quotedText = 61
    RULE_jsonObj = 62
    RULE_jsonPair = 63
    RULE_jsonArr = 64
    RULE_jsonValue = 65
    RULE_graphGlObj = 66
    RULE_graphGlCrudOptions = 67
    RULE_graphGlPair = 68
    RULE_graphKeyValue = 69
    RULE_graphGlReduceToValue = 70
    RULE_graphGlDatatypeValue = 71
    RULE_graphGlValue = 72

    ruleNames =  [ "mrsScript", "mrsStatement", "enabledDisabled", "quotedTextOrDefault", 
                   "jsonOptions", "comments", "authenticationRequired", 
                   "itemsPerPage", "itemsPerPageNumber", "serviceSchemaSelector", 
                   "configureRestMetadataStatement", "restMetadataOptions", 
                   "updateIfAvailable", "createRestServiceStatement", "restServiceOptions", 
                   "restProtocol", "restAuthentication", "authPath", "authRedirection", 
                   "authValidation", "authPageContent", "userManagementSchema", 
                   "createRestSchemaStatement", "restSchemaOptions", "createRestViewStatement", 
                   "restDualityViewOptions", "restViewMediaType", "restViewFormat", 
                   "restViewAuthenticationProcedure", "createRestProcedureStatement", 
                   "restProcedureResult", "dropRestServiceStatement", "dropRestSchemaStatement", 
                   "dropRestDualityViewStatement", "dropRestProcedureStatement", 
                   "useStatement", "serviceAndSchemaRequestPaths", "showRestMetadataStatusStatement", 
                   "showRestServicesStatement", "showRestSchemasStatement", 
                   "showRestViewsStatement", "showRestProceduresStatement", 
                   "serviceRequestPath", "schemaName", "schemaRequestPath", 
                   "viewName", "viewRequestPath", "restObjectName", "restResultName", 
                   "procedureName", "procedureRequestPath", "pureIdentifier", 
                   "identifier", "identifierList", "identifierListWithParentheses", 
                   "qualifiedIdentifier", "simpleIdentifier", "dotIdentifier", 
                   "dottedIdentifier", "hostAndPortIdentifier", "requestPathIdentifier", 
                   "quotedText", "jsonObj", "jsonPair", "jsonArr", "jsonValue", 
                   "graphGlObj", "graphGlCrudOptions", "graphGlPair", "graphKeyValue", 
                   "graphGlReduceToValue", "graphGlDatatypeValue", "graphGlValue" ]

    EOF = Token.EOF
    T__0=1
    T__1=2
    T__2=3
    T__3=4
    T__4=5
    CONFIGURE_SYMBOL=6
    CREATE_SYMBOL=7
    OR_SYMBOL=8
    REPLACE_SYMBOL=9
    SHOW_SYMBOL=10
    REST_SYMBOL=11
    METADATA_SYMBOL=12
    STATUS_SYMBOL=13
    SERVICES_SYMBOL=14
    SERVICE_SYMBOL=15
    ON_SYMBOL=16
    FROM_SYMBOL=17
    IN_SYMBOL=18
    SCHEMAS_SYMBOL=19
    SCHEMA_SYMBOL=20
    JSON_SYMBOL=21
    RELATIONAL_SYMBOL=22
    DUALITY_SYMBOL=23
    VIEWS_SYMBOL=24
    VIEW_SYMBOL=25
    PROCEDURES_SYMBOL=26
    PROCEDURE_SYMBOL=27
    PARAMETERS_SYMBOL=28
    RESULT_SYMBOL=29
    DROP_SYMBOL=30
    USE_SYMBOL=31
    AS_SYMBOL=32
    ENABLED_SYMBOL=33
    DISABLED_SYMBOL=34
    PROTOCOL_SYMBOL=35
    HTTP_SYMBOL=36
    HTTPS_SYMBOL=37
    FILTER_SYMBOL=38
    COMMENTS_SYMBOL=39
    AUTHENTICATION_SYMBOL=40
    PATH_SYMBOL=41
    REDIRECTION_SYMBOL=42
    VALIDATION_SYMBOL=43
    DEFAULT_SYMBOL=44
    USER_SYMBOL=45
    MANAGEMENT_SYMBOL=46
    OPTIONS_SYMBOL=47
    IF_SYMBOL=48
    AVAILABLE_SYMBOL=49
    NOT_SYMBOL=50
    EXISTS_SYMBOL=51
    REQUIRED_SYMBOL=52
    ITEMS_SYMBOL=53
    PER_SYMBOL=54
    PAGE_SYMBOL=55
    CONTENT_SYMBOL=56
    HOST_SYMBOL=57
    MEDIA_SYMBOL=58
    TYPE_SYMBOL=59
    AUTODETECT_SYMBOL=60
    FORMAT_SYMBOL=61
    FEED_SYMBOL=62
    ITEM_SYMBOL=63
    UPDATE_SYMBOL=64
    AT_INOUT_SYMBOL=65
    AT_IN_SYMBOL=66
    AT_OUT_SYMBOL=67
    AT_NOCHECK_SYMBOL=68
    AT_NOUPDATE_SYMBOL=69
    AT_SORTABLE_SYMBOL=70
    AT_NOFILTERING_SYMBOL=71
    AT_ROWOWNERSHIP_SYMBOL=72
    AT_UNNEST_SYMBOL=73
    AT_REDUCETO_SYMBOL=74
    AT_DATATYPE_SYMBOL=75
    AT_SELECT_SYMBOL=76
    AT_NOSELECT_SYMBOL=77
    AT_INSERT_SYMBOL=78
    AT_NOINSERT_SYMBOL=79
    AT_UPDATE_SYMBOL=80
    AT_DELETE_SYMBOL=81
    AT_NODELETE_SYMBOL=82
    EQUAL_OPERATOR=83
    ASSIGN_OPERATOR=84
    NULL_SAFE_EQUAL_OPERATOR=85
    GREATER_OR_EQUAL_OPERATOR=86
    GREATER_THAN_OPERATOR=87
    LESS_OR_EQUAL_OPERATOR=88
    LESS_THAN_OPERATOR=89
    NOT_EQUAL_OPERATOR=90
    PLUS_OPERATOR=91
    MINUS_OPERATOR=92
    MULT_OPERATOR=93
    DIV_OPERATOR=94
    MOD_OPERATOR=95
    LOGICAL_NOT_OPERATOR=96
    BITWISE_NOT_OPERATOR=97
    SHIFT_LEFT_OPERATOR=98
    SHIFT_RIGHT_OPERATOR=99
    LOGICAL_AND_OPERATOR=100
    BITWISE_AND_OPERATOR=101
    BITWISE_XOR_OPERATOR=102
    LOGICAL_OR_OPERATOR=103
    BITWISE_OR_OPERATOR=104
    DOT_SYMBOL=105
    COMMA_SYMBOL=106
    SEMICOLON_SYMBOL=107
    COLON_SYMBOL=108
    OPEN_PAR_SYMBOL=109
    CLOSE_PAR_SYMBOL=110
    OPEN_CURLY_SYMBOL=111
    CLOSE_CURLY_SYMBOL=112
    UNDERLINE_SYMBOL=113
    JSON_SEPARATOR_SYMBOL=114
    JSON_UNQUOTED_SEPARATOR_SYMBOL=115
    AT_SIGN_SYMBOL=116
    AT_TEXT_SUFFIX=117
    AT_AT_SIGN_SYMBOL=118
    NULL2_SYMBOL=119
    PARAM_MARKER=120
    HEX_NUMBER=121
    BIN_NUMBER=122
    INT_NUMBER=123
    DECIMAL_NUMBER=124
    FLOAT_NUMBER=125
    WHITESPACE=126
    INVALID_INPUT=127
    IDENTIFIER=128
    NCHAR_TEXT=129
    BACK_TICK_QUOTED_ID=130
    DOUBLE_QUOTED_TEXT=131
    SINGLE_QUOTED_TEXT=132
    BLOCK_COMMENT=133
    POUND_COMMENT=134
    DASHDASH_COMMENT=135
    JSON_STRING=136
    JSON_NUMBER=137
    WS=138
    NOT_EQUAL2_OPERATOR=139

    def __init__(self, input:TokenStream, output:TextIO = sys.stdout):
        super().__init__(input, output)
        self.checkVersion("4.13.0")
        self._interp = ParserATNSimulator(self, self.atn, self.decisionsToDFA, self.sharedContextCache)
        self._predicates = None




    class MrsScriptContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def EOF(self):
            return self.getToken(MRSParser.EOF, 0)

        def mrsStatement(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.MrsStatementContext)
            else:
                return self.getTypedRuleContext(MRSParser.MrsStatementContext,i)


        def SEMICOLON_SYMBOL(self, i:int=None):
            if i is None:
                return self.getTokens(MRSParser.SEMICOLON_SYMBOL)
            else:
                return self.getToken(MRSParser.SEMICOLON_SYMBOL, i)

        def getRuleIndex(self):
            return MRSParser.RULE_mrsScript

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterMrsScript" ):
                listener.enterMrsScript(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitMrsScript" ):
                listener.exitMrsScript(self)




    def mrsScript(self):

        localctx = MRSParser.MrsScriptContext(self, self._ctx, self.state)
        self.enterRule(localctx, 0, self.RULE_mrsScript)
        try:
            self.state = 162
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [-1]:
                self.enterOuterAlt(localctx, 1)
                self.state = 146
                self.match(MRSParser.EOF)
                pass
            elif token in [6, 7, 10, 30, 31]:
                self.enterOuterAlt(localctx, 2)
                self.state = 147
                self.mrsStatement()
                self.state = 152
                self._errHandler.sync(self)
                _alt = self._interp.adaptivePredict(self._input,0,self._ctx)
                while _alt!=2 and _alt!=ATN.INVALID_ALT_NUMBER:
                    if _alt==1:
                        self.state = 148
                        self.match(MRSParser.SEMICOLON_SYMBOL)
                        self.state = 149
                        self.mrsStatement() 
                    self.state = 154
                    self._errHandler.sync(self)
                    _alt = self._interp.adaptivePredict(self._input,0,self._ctx)

                self.state = 160
                self._errHandler.sync(self)
                token = self._input.LA(1)
                if token in [107]:
                    self.state = 155
                    self.match(MRSParser.SEMICOLON_SYMBOL)
                    self.state = 157
                    self._errHandler.sync(self)
                    la_ = self._interp.adaptivePredict(self._input,1,self._ctx)
                    if la_ == 1:
                        self.state = 156
                        self.match(MRSParser.EOF)


                    pass
                elif token in [-1]:
                    self.state = 159
                    self.match(MRSParser.EOF)
                    pass
                else:
                    raise NoViableAltException(self)

                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class MrsStatementContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def configureRestMetadataStatement(self):
            return self.getTypedRuleContext(MRSParser.ConfigureRestMetadataStatementContext,0)


        def createRestServiceStatement(self):
            return self.getTypedRuleContext(MRSParser.CreateRestServiceStatementContext,0)


        def createRestSchemaStatement(self):
            return self.getTypedRuleContext(MRSParser.CreateRestSchemaStatementContext,0)


        def createRestViewStatement(self):
            return self.getTypedRuleContext(MRSParser.CreateRestViewStatementContext,0)


        def createRestProcedureStatement(self):
            return self.getTypedRuleContext(MRSParser.CreateRestProcedureStatementContext,0)


        def dropRestServiceStatement(self):
            return self.getTypedRuleContext(MRSParser.DropRestServiceStatementContext,0)


        def dropRestSchemaStatement(self):
            return self.getTypedRuleContext(MRSParser.DropRestSchemaStatementContext,0)


        def dropRestDualityViewStatement(self):
            return self.getTypedRuleContext(MRSParser.DropRestDualityViewStatementContext,0)


        def dropRestProcedureStatement(self):
            return self.getTypedRuleContext(MRSParser.DropRestProcedureStatementContext,0)


        def useStatement(self):
            return self.getTypedRuleContext(MRSParser.UseStatementContext,0)


        def showRestMetadataStatusStatement(self):
            return self.getTypedRuleContext(MRSParser.ShowRestMetadataStatusStatementContext,0)


        def showRestServicesStatement(self):
            return self.getTypedRuleContext(MRSParser.ShowRestServicesStatementContext,0)


        def showRestSchemasStatement(self):
            return self.getTypedRuleContext(MRSParser.ShowRestSchemasStatementContext,0)


        def showRestViewsStatement(self):
            return self.getTypedRuleContext(MRSParser.ShowRestViewsStatementContext,0)


        def showRestProceduresStatement(self):
            return self.getTypedRuleContext(MRSParser.ShowRestProceduresStatementContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_mrsStatement

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterMrsStatement" ):
                listener.enterMrsStatement(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitMrsStatement" ):
                listener.exitMrsStatement(self)




    def mrsStatement(self):

        localctx = MRSParser.MrsStatementContext(self, self._ctx, self.state)
        self.enterRule(localctx, 2, self.RULE_mrsStatement)
        try:
            self.state = 179
            self._errHandler.sync(self)
            la_ = self._interp.adaptivePredict(self._input,4,self._ctx)
            if la_ == 1:
                self.enterOuterAlt(localctx, 1)
                self.state = 164
                self.configureRestMetadataStatement()
                pass

            elif la_ == 2:
                self.enterOuterAlt(localctx, 2)
                self.state = 165
                self.createRestServiceStatement()
                pass

            elif la_ == 3:
                self.enterOuterAlt(localctx, 3)
                self.state = 166
                self.createRestSchemaStatement()
                pass

            elif la_ == 4:
                self.enterOuterAlt(localctx, 4)
                self.state = 167
                self.createRestViewStatement()
                pass

            elif la_ == 5:
                self.enterOuterAlt(localctx, 5)
                self.state = 168
                self.createRestProcedureStatement()
                pass

            elif la_ == 6:
                self.enterOuterAlt(localctx, 6)
                self.state = 169
                self.dropRestServiceStatement()
                pass

            elif la_ == 7:
                self.enterOuterAlt(localctx, 7)
                self.state = 170
                self.dropRestSchemaStatement()
                pass

            elif la_ == 8:
                self.enterOuterAlt(localctx, 8)
                self.state = 171
                self.dropRestDualityViewStatement()
                pass

            elif la_ == 9:
                self.enterOuterAlt(localctx, 9)
                self.state = 172
                self.dropRestProcedureStatement()
                pass

            elif la_ == 10:
                self.enterOuterAlt(localctx, 10)
                self.state = 173
                self.useStatement()
                pass

            elif la_ == 11:
                self.enterOuterAlt(localctx, 11)
                self.state = 174
                self.showRestMetadataStatusStatement()
                pass

            elif la_ == 12:
                self.enterOuterAlt(localctx, 12)
                self.state = 175
                self.showRestServicesStatement()
                pass

            elif la_ == 13:
                self.enterOuterAlt(localctx, 13)
                self.state = 176
                self.showRestSchemasStatement()
                pass

            elif la_ == 14:
                self.enterOuterAlt(localctx, 14)
                self.state = 177
                self.showRestViewsStatement()
                pass

            elif la_ == 15:
                self.enterOuterAlt(localctx, 15)
                self.state = 178
                self.showRestProceduresStatement()
                pass


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class EnabledDisabledContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def ENABLED_SYMBOL(self):
            return self.getToken(MRSParser.ENABLED_SYMBOL, 0)

        def DISABLED_SYMBOL(self):
            return self.getToken(MRSParser.DISABLED_SYMBOL, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_enabledDisabled

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterEnabledDisabled" ):
                listener.enterEnabledDisabled(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitEnabledDisabled" ):
                listener.exitEnabledDisabled(self)




    def enabledDisabled(self):

        localctx = MRSParser.EnabledDisabledContext(self, self._ctx, self.state)
        self.enterRule(localctx, 4, self.RULE_enabledDisabled)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 181
            _la = self._input.LA(1)
            if not(_la==33 or _la==34):
                self._errHandler.recoverInline(self)
            else:
                self._errHandler.reportMatch(self)
                self.consume()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class QuotedTextOrDefaultContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def quotedText(self):
            return self.getTypedRuleContext(MRSParser.QuotedTextContext,0)


        def DEFAULT_SYMBOL(self):
            return self.getToken(MRSParser.DEFAULT_SYMBOL, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_quotedTextOrDefault

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterQuotedTextOrDefault" ):
                listener.enterQuotedTextOrDefault(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitQuotedTextOrDefault" ):
                listener.exitQuotedTextOrDefault(self)




    def quotedTextOrDefault(self):

        localctx = MRSParser.QuotedTextOrDefaultContext(self, self._ctx, self.state)
        self.enterRule(localctx, 6, self.RULE_quotedTextOrDefault)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 185
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [131, 132]:
                self.state = 183
                self.quotedText()
                pass
            elif token in [44]:
                self.state = 184
                self.match(MRSParser.DEFAULT_SYMBOL)
                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class JsonOptionsContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def OPTIONS_SYMBOL(self):
            return self.getToken(MRSParser.OPTIONS_SYMBOL, 0)

        def jsonValue(self):
            return self.getTypedRuleContext(MRSParser.JsonValueContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_jsonOptions

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterJsonOptions" ):
                listener.enterJsonOptions(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitJsonOptions" ):
                listener.exitJsonOptions(self)




    def jsonOptions(self):

        localctx = MRSParser.JsonOptionsContext(self, self._ctx, self.state)
        self.enterRule(localctx, 8, self.RULE_jsonOptions)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 187
            self.match(MRSParser.OPTIONS_SYMBOL)
            self.state = 188
            self.jsonValue()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class CommentsContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def COMMENTS_SYMBOL(self):
            return self.getToken(MRSParser.COMMENTS_SYMBOL, 0)

        def quotedText(self):
            return self.getTypedRuleContext(MRSParser.QuotedTextContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_comments

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterComments" ):
                listener.enterComments(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitComments" ):
                listener.exitComments(self)




    def comments(self):

        localctx = MRSParser.CommentsContext(self, self._ctx, self.state)
        self.enterRule(localctx, 10, self.RULE_comments)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 190
            self.match(MRSParser.COMMENTS_SYMBOL)
            self.state = 191
            self.quotedText()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class AuthenticationRequiredContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def AUTHENTICATION_SYMBOL(self):
            return self.getToken(MRSParser.AUTHENTICATION_SYMBOL, 0)

        def REQUIRED_SYMBOL(self):
            return self.getToken(MRSParser.REQUIRED_SYMBOL, 0)

        def NOT_SYMBOL(self):
            return self.getToken(MRSParser.NOT_SYMBOL, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_authenticationRequired

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterAuthenticationRequired" ):
                listener.enterAuthenticationRequired(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitAuthenticationRequired" ):
                listener.exitAuthenticationRequired(self)




    def authenticationRequired(self):

        localctx = MRSParser.AuthenticationRequiredContext(self, self._ctx, self.state)
        self.enterRule(localctx, 12, self.RULE_authenticationRequired)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 193
            self.match(MRSParser.AUTHENTICATION_SYMBOL)
            self.state = 195
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==50:
                self.state = 194
                self.match(MRSParser.NOT_SYMBOL)


            self.state = 197
            self.match(MRSParser.REQUIRED_SYMBOL)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ItemsPerPageContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def ITEMS_SYMBOL(self):
            return self.getToken(MRSParser.ITEMS_SYMBOL, 0)

        def PER_SYMBOL(self):
            return self.getToken(MRSParser.PER_SYMBOL, 0)

        def PAGE_SYMBOL(self):
            return self.getToken(MRSParser.PAGE_SYMBOL, 0)

        def itemsPerPageNumber(self):
            return self.getTypedRuleContext(MRSParser.ItemsPerPageNumberContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_itemsPerPage

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterItemsPerPage" ):
                listener.enterItemsPerPage(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitItemsPerPage" ):
                listener.exitItemsPerPage(self)




    def itemsPerPage(self):

        localctx = MRSParser.ItemsPerPageContext(self, self._ctx, self.state)
        self.enterRule(localctx, 14, self.RULE_itemsPerPage)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 199
            self.match(MRSParser.ITEMS_SYMBOL)
            self.state = 200
            self.match(MRSParser.PER_SYMBOL)
            self.state = 201
            self.match(MRSParser.PAGE_SYMBOL)
            self.state = 202
            self.itemsPerPageNumber()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ItemsPerPageNumberContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def INT_NUMBER(self):
            return self.getToken(MRSParser.INT_NUMBER, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_itemsPerPageNumber

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterItemsPerPageNumber" ):
                listener.enterItemsPerPageNumber(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitItemsPerPageNumber" ):
                listener.exitItemsPerPageNumber(self)




    def itemsPerPageNumber(self):

        localctx = MRSParser.ItemsPerPageNumberContext(self, self._ctx, self.state)
        self.enterRule(localctx, 16, self.RULE_itemsPerPageNumber)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 204
            self.match(MRSParser.INT_NUMBER)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ServiceSchemaSelectorContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def ON_SYMBOL(self):
            return self.getToken(MRSParser.ON_SYMBOL, 0)

        def SCHEMA_SYMBOL(self):
            return self.getToken(MRSParser.SCHEMA_SYMBOL, 0)

        def schemaRequestPath(self):
            return self.getTypedRuleContext(MRSParser.SchemaRequestPathContext,0)


        def SERVICE_SYMBOL(self):
            return self.getToken(MRSParser.SERVICE_SYMBOL, 0)

        def serviceRequestPath(self):
            return self.getTypedRuleContext(MRSParser.ServiceRequestPathContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_serviceSchemaSelector

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterServiceSchemaSelector" ):
                listener.enterServiceSchemaSelector(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitServiceSchemaSelector" ):
                listener.exitServiceSchemaSelector(self)




    def serviceSchemaSelector(self):

        localctx = MRSParser.ServiceSchemaSelectorContext(self, self._ctx, self.state)
        self.enterRule(localctx, 18, self.RULE_serviceSchemaSelector)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 206
            self.match(MRSParser.ON_SYMBOL)
            self.state = 209
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==15:
                self.state = 207
                self.match(MRSParser.SERVICE_SYMBOL)
                self.state = 208
                self.serviceRequestPath()


            self.state = 211
            self.match(MRSParser.SCHEMA_SYMBOL)
            self.state = 212
            self.schemaRequestPath()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ConfigureRestMetadataStatementContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def CONFIGURE_SYMBOL(self):
            return self.getToken(MRSParser.CONFIGURE_SYMBOL, 0)

        def REST_SYMBOL(self):
            return self.getToken(MRSParser.REST_SYMBOL, 0)

        def METADATA_SYMBOL(self):
            return self.getToken(MRSParser.METADATA_SYMBOL, 0)

        def restMetadataOptions(self):
            return self.getTypedRuleContext(MRSParser.RestMetadataOptionsContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_configureRestMetadataStatement

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterConfigureRestMetadataStatement" ):
                listener.enterConfigureRestMetadataStatement(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitConfigureRestMetadataStatement" ):
                listener.exitConfigureRestMetadataStatement(self)




    def configureRestMetadataStatement(self):

        localctx = MRSParser.ConfigureRestMetadataStatementContext(self, self._ctx, self.state)
        self.enterRule(localctx, 20, self.RULE_configureRestMetadataStatement)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 214
            self.match(MRSParser.CONFIGURE_SYMBOL)
            self.state = 215
            self.match(MRSParser.REST_SYMBOL)
            self.state = 216
            self.match(MRSParser.METADATA_SYMBOL)
            self.state = 218
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if ((((_la - 33)) & ~0x3f) == 0 and ((1 << (_la - 33)) & 2147500035) != 0):
                self.state = 217
                self.restMetadataOptions()


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class RestMetadataOptionsContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def enabledDisabled(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.EnabledDisabledContext)
            else:
                return self.getTypedRuleContext(MRSParser.EnabledDisabledContext,i)


        def jsonOptions(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.JsonOptionsContext)
            else:
                return self.getTypedRuleContext(MRSParser.JsonOptionsContext,i)


        def updateIfAvailable(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.UpdateIfAvailableContext)
            else:
                return self.getTypedRuleContext(MRSParser.UpdateIfAvailableContext,i)


        def getRuleIndex(self):
            return MRSParser.RULE_restMetadataOptions

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterRestMetadataOptions" ):
                listener.enterRestMetadataOptions(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitRestMetadataOptions" ):
                listener.exitRestMetadataOptions(self)




    def restMetadataOptions(self):

        localctx = MRSParser.RestMetadataOptionsContext(self, self._ctx, self.state)
        self.enterRule(localctx, 22, self.RULE_restMetadataOptions)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 223 
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while True:
                self.state = 223
                self._errHandler.sync(self)
                token = self._input.LA(1)
                if token in [33, 34]:
                    self.state = 220
                    self.enabledDisabled()
                    pass
                elif token in [47]:
                    self.state = 221
                    self.jsonOptions()
                    pass
                elif token in [64]:
                    self.state = 222
                    self.updateIfAvailable()
                    pass
                else:
                    raise NoViableAltException(self)

                self.state = 225 
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if not (((((_la - 33)) & ~0x3f) == 0 and ((1 << (_la - 33)) & 2147500035) != 0)):
                    break

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class UpdateIfAvailableContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def UPDATE_SYMBOL(self):
            return self.getToken(MRSParser.UPDATE_SYMBOL, 0)

        def IF_SYMBOL(self):
            return self.getToken(MRSParser.IF_SYMBOL, 0)

        def AVAILABLE_SYMBOL(self):
            return self.getToken(MRSParser.AVAILABLE_SYMBOL, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_updateIfAvailable

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterUpdateIfAvailable" ):
                listener.enterUpdateIfAvailable(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitUpdateIfAvailable" ):
                listener.exitUpdateIfAvailable(self)




    def updateIfAvailable(self):

        localctx = MRSParser.UpdateIfAvailableContext(self, self._ctx, self.state)
        self.enterRule(localctx, 24, self.RULE_updateIfAvailable)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 227
            self.match(MRSParser.UPDATE_SYMBOL)
            self.state = 230
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==48:
                self.state = 228
                self.match(MRSParser.IF_SYMBOL)
                self.state = 229
                self.match(MRSParser.AVAILABLE_SYMBOL)


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class CreateRestServiceStatementContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def CREATE_SYMBOL(self):
            return self.getToken(MRSParser.CREATE_SYMBOL, 0)

        def REST_SYMBOL(self):
            return self.getToken(MRSParser.REST_SYMBOL, 0)

        def SERVICE_SYMBOL(self):
            return self.getToken(MRSParser.SERVICE_SYMBOL, 0)

        def serviceRequestPath(self):
            return self.getTypedRuleContext(MRSParser.ServiceRequestPathContext,0)


        def OR_SYMBOL(self):
            return self.getToken(MRSParser.OR_SYMBOL, 0)

        def REPLACE_SYMBOL(self):
            return self.getToken(MRSParser.REPLACE_SYMBOL, 0)

        def restServiceOptions(self):
            return self.getTypedRuleContext(MRSParser.RestServiceOptionsContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_createRestServiceStatement

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterCreateRestServiceStatement" ):
                listener.enterCreateRestServiceStatement(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitCreateRestServiceStatement" ):
                listener.exitCreateRestServiceStatement(self)




    def createRestServiceStatement(self):

        localctx = MRSParser.CreateRestServiceStatementContext(self, self._ctx, self.state)
        self.enterRule(localctx, 26, self.RULE_createRestServiceStatement)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 232
            self.match(MRSParser.CREATE_SYMBOL)
            self.state = 235
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==8:
                self.state = 233
                self.match(MRSParser.OR_SYMBOL)
                self.state = 234
                self.match(MRSParser.REPLACE_SYMBOL)


            self.state = 237
            self.match(MRSParser.REST_SYMBOL)
            self.state = 238
            self.match(MRSParser.SERVICE_SYMBOL)
            self.state = 239
            self.serviceRequestPath()
            self.state = 241
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if (((_la) & ~0x3f) == 0 and ((1 << _la) & 177631257427968) != 0):
                self.state = 240
                self.restServiceOptions()


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class RestServiceOptionsContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def enabledDisabled(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.EnabledDisabledContext)
            else:
                return self.getTypedRuleContext(MRSParser.EnabledDisabledContext,i)


        def restProtocol(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.RestProtocolContext)
            else:
                return self.getTypedRuleContext(MRSParser.RestProtocolContext,i)


        def restAuthentication(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.RestAuthenticationContext)
            else:
                return self.getTypedRuleContext(MRSParser.RestAuthenticationContext,i)


        def userManagementSchema(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.UserManagementSchemaContext)
            else:
                return self.getTypedRuleContext(MRSParser.UserManagementSchemaContext,i)


        def jsonOptions(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.JsonOptionsContext)
            else:
                return self.getTypedRuleContext(MRSParser.JsonOptionsContext,i)


        def comments(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.CommentsContext)
            else:
                return self.getTypedRuleContext(MRSParser.CommentsContext,i)


        def getRuleIndex(self):
            return MRSParser.RULE_restServiceOptions

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterRestServiceOptions" ):
                listener.enterRestServiceOptions(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitRestServiceOptions" ):
                listener.exitRestServiceOptions(self)




    def restServiceOptions(self):

        localctx = MRSParser.RestServiceOptionsContext(self, self._ctx, self.state)
        self.enterRule(localctx, 28, self.RULE_restServiceOptions)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 249 
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while True:
                self.state = 249
                self._errHandler.sync(self)
                token = self._input.LA(1)
                if token in [33, 34]:
                    self.state = 243
                    self.enabledDisabled()
                    pass
                elif token in [35]:
                    self.state = 244
                    self.restProtocol()
                    pass
                elif token in [40]:
                    self.state = 245
                    self.restAuthentication()
                    pass
                elif token in [45]:
                    self.state = 246
                    self.userManagementSchema()
                    pass
                elif token in [47]:
                    self.state = 247
                    self.jsonOptions()
                    pass
                elif token in [39]:
                    self.state = 248
                    self.comments()
                    pass
                else:
                    raise NoViableAltException(self)

                self.state = 251 
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if not ((((_la) & ~0x3f) == 0 and ((1 << _la) & 177631257427968) != 0)):
                    break

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class RestProtocolContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def PROTOCOL_SYMBOL(self):
            return self.getToken(MRSParser.PROTOCOL_SYMBOL, 0)

        def HTTP_SYMBOL(self):
            return self.getToken(MRSParser.HTTP_SYMBOL, 0)

        def HTTPS_SYMBOL(self):
            return self.getToken(MRSParser.HTTPS_SYMBOL, 0)

        def COMMA_SYMBOL(self):
            return self.getToken(MRSParser.COMMA_SYMBOL, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_restProtocol

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterRestProtocol" ):
                listener.enterRestProtocol(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitRestProtocol" ):
                listener.exitRestProtocol(self)




    def restProtocol(self):

        localctx = MRSParser.RestProtocolContext(self, self._ctx, self.state)
        self.enterRule(localctx, 30, self.RULE_restProtocol)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 253
            self.match(MRSParser.PROTOCOL_SYMBOL)
            self.state = 262
            self._errHandler.sync(self)
            la_ = self._interp.adaptivePredict(self._input,16,self._ctx)
            if la_ == 1:
                self.state = 254
                self.match(MRSParser.HTTP_SYMBOL)
                pass

            elif la_ == 2:
                self.state = 255
                self.match(MRSParser.HTTPS_SYMBOL)
                pass

            elif la_ == 3:
                self.state = 256
                self.match(MRSParser.HTTP_SYMBOL)
                self.state = 257
                self.match(MRSParser.COMMA_SYMBOL)
                self.state = 258
                self.match(MRSParser.HTTPS_SYMBOL)
                pass

            elif la_ == 4:
                self.state = 259
                self.match(MRSParser.HTTPS_SYMBOL)
                self.state = 260
                self.match(MRSParser.COMMA_SYMBOL)
                self.state = 261
                self.match(MRSParser.HTTP_SYMBOL)
                pass


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class RestAuthenticationContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def AUTHENTICATION_SYMBOL(self):
            return self.getToken(MRSParser.AUTHENTICATION_SYMBOL, 0)

        def authPath(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.AuthPathContext)
            else:
                return self.getTypedRuleContext(MRSParser.AuthPathContext,i)


        def authRedirection(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.AuthRedirectionContext)
            else:
                return self.getTypedRuleContext(MRSParser.AuthRedirectionContext,i)


        def authValidation(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.AuthValidationContext)
            else:
                return self.getTypedRuleContext(MRSParser.AuthValidationContext,i)


        def authPageContent(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.AuthPageContentContext)
            else:
                return self.getTypedRuleContext(MRSParser.AuthPageContentContext,i)


        def getRuleIndex(self):
            return MRSParser.RULE_restAuthentication

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterRestAuthentication" ):
                listener.enterRestAuthentication(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitRestAuthentication" ):
                listener.exitRestAuthentication(self)




    def restAuthentication(self):

        localctx = MRSParser.RestAuthenticationContext(self, self._ctx, self.state)
        self.enterRule(localctx, 32, self.RULE_restAuthentication)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 264
            self.match(MRSParser.AUTHENTICATION_SYMBOL)
            self.state = 271
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while (((_la) & ~0x3f) == 0 and ((1 << _la) & 36044190181752832) != 0):
                self.state = 269
                self._errHandler.sync(self)
                token = self._input.LA(1)
                if token in [41]:
                    self.state = 265
                    self.authPath()
                    pass
                elif token in [42]:
                    self.state = 266
                    self.authRedirection()
                    pass
                elif token in [43]:
                    self.state = 267
                    self.authValidation()
                    pass
                elif token in [55]:
                    self.state = 268
                    self.authPageContent()
                    pass
                else:
                    raise NoViableAltException(self)

                self.state = 273
                self._errHandler.sync(self)
                _la = self._input.LA(1)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class AuthPathContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def PATH_SYMBOL(self):
            return self.getToken(MRSParser.PATH_SYMBOL, 0)

        def quotedTextOrDefault(self):
            return self.getTypedRuleContext(MRSParser.QuotedTextOrDefaultContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_authPath

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterAuthPath" ):
                listener.enterAuthPath(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitAuthPath" ):
                listener.exitAuthPath(self)




    def authPath(self):

        localctx = MRSParser.AuthPathContext(self, self._ctx, self.state)
        self.enterRule(localctx, 34, self.RULE_authPath)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 274
            self.match(MRSParser.PATH_SYMBOL)
            self.state = 275
            self.quotedTextOrDefault()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class AuthRedirectionContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def REDIRECTION_SYMBOL(self):
            return self.getToken(MRSParser.REDIRECTION_SYMBOL, 0)

        def quotedTextOrDefault(self):
            return self.getTypedRuleContext(MRSParser.QuotedTextOrDefaultContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_authRedirection

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterAuthRedirection" ):
                listener.enterAuthRedirection(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitAuthRedirection" ):
                listener.exitAuthRedirection(self)




    def authRedirection(self):

        localctx = MRSParser.AuthRedirectionContext(self, self._ctx, self.state)
        self.enterRule(localctx, 36, self.RULE_authRedirection)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 277
            self.match(MRSParser.REDIRECTION_SYMBOL)
            self.state = 278
            self.quotedTextOrDefault()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class AuthValidationContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def VALIDATION_SYMBOL(self):
            return self.getToken(MRSParser.VALIDATION_SYMBOL, 0)

        def quotedTextOrDefault(self):
            return self.getTypedRuleContext(MRSParser.QuotedTextOrDefaultContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_authValidation

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterAuthValidation" ):
                listener.enterAuthValidation(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitAuthValidation" ):
                listener.exitAuthValidation(self)




    def authValidation(self):

        localctx = MRSParser.AuthValidationContext(self, self._ctx, self.state)
        self.enterRule(localctx, 38, self.RULE_authValidation)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 280
            self.match(MRSParser.VALIDATION_SYMBOL)
            self.state = 281
            self.quotedTextOrDefault()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class AuthPageContentContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def PAGE_SYMBOL(self):
            return self.getToken(MRSParser.PAGE_SYMBOL, 0)

        def CONTENT_SYMBOL(self):
            return self.getToken(MRSParser.CONTENT_SYMBOL, 0)

        def quotedTextOrDefault(self):
            return self.getTypedRuleContext(MRSParser.QuotedTextOrDefaultContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_authPageContent

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterAuthPageContent" ):
                listener.enterAuthPageContent(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitAuthPageContent" ):
                listener.exitAuthPageContent(self)




    def authPageContent(self):

        localctx = MRSParser.AuthPageContentContext(self, self._ctx, self.state)
        self.enterRule(localctx, 40, self.RULE_authPageContent)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 283
            self.match(MRSParser.PAGE_SYMBOL)
            self.state = 284
            self.match(MRSParser.CONTENT_SYMBOL)
            self.state = 285
            self.quotedTextOrDefault()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class UserManagementSchemaContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def USER_SYMBOL(self):
            return self.getToken(MRSParser.USER_SYMBOL, 0)

        def MANAGEMENT_SYMBOL(self):
            return self.getToken(MRSParser.MANAGEMENT_SYMBOL, 0)

        def SCHEMA_SYMBOL(self):
            return self.getToken(MRSParser.SCHEMA_SYMBOL, 0)

        def schemaName(self):
            return self.getTypedRuleContext(MRSParser.SchemaNameContext,0)


        def DEFAULT_SYMBOL(self):
            return self.getToken(MRSParser.DEFAULT_SYMBOL, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_userManagementSchema

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterUserManagementSchema" ):
                listener.enterUserManagementSchema(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitUserManagementSchema" ):
                listener.exitUserManagementSchema(self)




    def userManagementSchema(self):

        localctx = MRSParser.UserManagementSchemaContext(self, self._ctx, self.state)
        self.enterRule(localctx, 42, self.RULE_userManagementSchema)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 287
            self.match(MRSParser.USER_SYMBOL)
            self.state = 288
            self.match(MRSParser.MANAGEMENT_SYMBOL)
            self.state = 289
            self.match(MRSParser.SCHEMA_SYMBOL)
            self.state = 292
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [128, 130]:
                self.state = 290
                self.schemaName()
                pass
            elif token in [44]:
                self.state = 291
                self.match(MRSParser.DEFAULT_SYMBOL)
                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class CreateRestSchemaStatementContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def CREATE_SYMBOL(self):
            return self.getToken(MRSParser.CREATE_SYMBOL, 0)

        def REST_SYMBOL(self):
            return self.getToken(MRSParser.REST_SYMBOL, 0)

        def SCHEMA_SYMBOL(self):
            return self.getToken(MRSParser.SCHEMA_SYMBOL, 0)

        def FROM_SYMBOL(self):
            return self.getToken(MRSParser.FROM_SYMBOL, 0)

        def schemaName(self):
            return self.getTypedRuleContext(MRSParser.SchemaNameContext,0)


        def OR_SYMBOL(self):
            return self.getToken(MRSParser.OR_SYMBOL, 0)

        def REPLACE_SYMBOL(self):
            return self.getToken(MRSParser.REPLACE_SYMBOL, 0)

        def schemaRequestPath(self):
            return self.getTypedRuleContext(MRSParser.SchemaRequestPathContext,0)


        def ON_SYMBOL(self):
            return self.getToken(MRSParser.ON_SYMBOL, 0)

        def serviceRequestPath(self):
            return self.getTypedRuleContext(MRSParser.ServiceRequestPathContext,0)


        def restSchemaOptions(self):
            return self.getTypedRuleContext(MRSParser.RestSchemaOptionsContext,0)


        def SERVICE_SYMBOL(self):
            return self.getToken(MRSParser.SERVICE_SYMBOL, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_createRestSchemaStatement

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterCreateRestSchemaStatement" ):
                listener.enterCreateRestSchemaStatement(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitCreateRestSchemaStatement" ):
                listener.exitCreateRestSchemaStatement(self)




    def createRestSchemaStatement(self):

        localctx = MRSParser.CreateRestSchemaStatementContext(self, self._ctx, self.state)
        self.enterRule(localctx, 44, self.RULE_createRestSchemaStatement)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 294
            self.match(MRSParser.CREATE_SYMBOL)
            self.state = 297
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==8:
                self.state = 295
                self.match(MRSParser.OR_SYMBOL)
                self.state = 296
                self.match(MRSParser.REPLACE_SYMBOL)


            self.state = 299
            self.match(MRSParser.REST_SYMBOL)
            self.state = 300
            self.match(MRSParser.SCHEMA_SYMBOL)
            self.state = 302
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==94:
                self.state = 301
                self.schemaRequestPath()


            self.state = 309
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==16:
                self.state = 304
                self.match(MRSParser.ON_SYMBOL)
                self.state = 306
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if _la==15:
                    self.state = 305
                    self.match(MRSParser.SERVICE_SYMBOL)


                self.state = 308
                self.serviceRequestPath()


            self.state = 311
            self.match(MRSParser.FROM_SYMBOL)
            self.state = 312
            self.schemaName()
            self.state = 314
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if (((_la) & ~0x3f) == 0 and ((1 << _la) & 9149611780341760) != 0):
                self.state = 313
                self.restSchemaOptions()


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class RestSchemaOptionsContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def enabledDisabled(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.EnabledDisabledContext)
            else:
                return self.getTypedRuleContext(MRSParser.EnabledDisabledContext,i)


        def authenticationRequired(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.AuthenticationRequiredContext)
            else:
                return self.getTypedRuleContext(MRSParser.AuthenticationRequiredContext,i)


        def itemsPerPage(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.ItemsPerPageContext)
            else:
                return self.getTypedRuleContext(MRSParser.ItemsPerPageContext,i)


        def jsonOptions(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.JsonOptionsContext)
            else:
                return self.getTypedRuleContext(MRSParser.JsonOptionsContext,i)


        def comments(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.CommentsContext)
            else:
                return self.getTypedRuleContext(MRSParser.CommentsContext,i)


        def getRuleIndex(self):
            return MRSParser.RULE_restSchemaOptions

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterRestSchemaOptions" ):
                listener.enterRestSchemaOptions(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitRestSchemaOptions" ):
                listener.exitRestSchemaOptions(self)




    def restSchemaOptions(self):

        localctx = MRSParser.RestSchemaOptionsContext(self, self._ctx, self.state)
        self.enterRule(localctx, 46, self.RULE_restSchemaOptions)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 321 
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while True:
                self.state = 321
                self._errHandler.sync(self)
                token = self._input.LA(1)
                if token in [33, 34]:
                    self.state = 316
                    self.enabledDisabled()
                    pass
                elif token in [40]:
                    self.state = 317
                    self.authenticationRequired()
                    pass
                elif token in [53]:
                    self.state = 318
                    self.itemsPerPage()
                    pass
                elif token in [47]:
                    self.state = 319
                    self.jsonOptions()
                    pass
                elif token in [39]:
                    self.state = 320
                    self.comments()
                    pass
                else:
                    raise NoViableAltException(self)

                self.state = 323 
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if not ((((_la) & ~0x3f) == 0 and ((1 << _la) & 9149611780341760) != 0)):
                    break

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class CreateRestViewStatementContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def CREATE_SYMBOL(self):
            return self.getToken(MRSParser.CREATE_SYMBOL, 0)

        def REST_SYMBOL(self):
            return self.getToken(MRSParser.REST_SYMBOL, 0)

        def VIEW_SYMBOL(self):
            return self.getToken(MRSParser.VIEW_SYMBOL, 0)

        def viewRequestPath(self):
            return self.getTypedRuleContext(MRSParser.ViewRequestPathContext,0)


        def FROM_SYMBOL(self):
            return self.getToken(MRSParser.FROM_SYMBOL, 0)

        def qualifiedIdentifier(self):
            return self.getTypedRuleContext(MRSParser.QualifiedIdentifierContext,0)


        def AS_SYMBOL(self):
            return self.getToken(MRSParser.AS_SYMBOL, 0)

        def restObjectName(self):
            return self.getTypedRuleContext(MRSParser.RestObjectNameContext,0)


        def graphGlObj(self):
            return self.getTypedRuleContext(MRSParser.GraphGlObjContext,0)


        def OR_SYMBOL(self):
            return self.getToken(MRSParser.OR_SYMBOL, 0)

        def REPLACE_SYMBOL(self):
            return self.getToken(MRSParser.REPLACE_SYMBOL, 0)

        def RELATIONAL_SYMBOL(self):
            return self.getToken(MRSParser.RELATIONAL_SYMBOL, 0)

        def JSON_SYMBOL(self):
            return self.getToken(MRSParser.JSON_SYMBOL, 0)

        def DUALITY_SYMBOL(self):
            return self.getToken(MRSParser.DUALITY_SYMBOL, 0)

        def serviceSchemaSelector(self):
            return self.getTypedRuleContext(MRSParser.ServiceSchemaSelectorContext,0)


        def restDualityViewOptions(self):
            return self.getTypedRuleContext(MRSParser.RestDualityViewOptionsContext,0)


        def graphGlCrudOptions(self):
            return self.getTypedRuleContext(MRSParser.GraphGlCrudOptionsContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_createRestViewStatement

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterCreateRestViewStatement" ):
                listener.enterCreateRestViewStatement(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitCreateRestViewStatement" ):
                listener.exitCreateRestViewStatement(self)




    def createRestViewStatement(self):

        localctx = MRSParser.CreateRestViewStatementContext(self, self._ctx, self.state)
        self.enterRule(localctx, 48, self.RULE_createRestViewStatement)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 325
            self.match(MRSParser.CREATE_SYMBOL)
            self.state = 328
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==8:
                self.state = 326
                self.match(MRSParser.OR_SYMBOL)
                self.state = 327
                self.match(MRSParser.REPLACE_SYMBOL)


            self.state = 330
            self.match(MRSParser.REST_SYMBOL)
            self.state = 332
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==22:
                self.state = 331
                self.match(MRSParser.RELATIONAL_SYMBOL)


            self.state = 335
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==21:
                self.state = 334
                self.match(MRSParser.JSON_SYMBOL)


            self.state = 338
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==23:
                self.state = 337
                self.match(MRSParser.DUALITY_SYMBOL)


            self.state = 340
            self.match(MRSParser.VIEW_SYMBOL)
            self.state = 341
            self.viewRequestPath()
            self.state = 343
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==16:
                self.state = 342
                self.serviceSchemaSelector()


            self.state = 345
            self.match(MRSParser.FROM_SYMBOL)
            self.state = 346
            self.qualifiedIdentifier()
            self.state = 348
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if (((_la) & ~0x3f) == 0 and ((1 << _la) & 2603222997145747456) != 0):
                self.state = 347
                self.restDualityViewOptions()


            self.state = 350
            self.match(MRSParser.AS_SYMBOL)
            self.state = 351
            self.restObjectName()
            self.state = 353
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if ((((_la - 69)) & ~0x3f) == 0 and ((1 << (_la - 69)) & 16257) != 0):
                self.state = 352
                self.graphGlCrudOptions()


            self.state = 355
            self.graphGlObj()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class RestDualityViewOptionsContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def enabledDisabled(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.EnabledDisabledContext)
            else:
                return self.getTypedRuleContext(MRSParser.EnabledDisabledContext,i)


        def authenticationRequired(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.AuthenticationRequiredContext)
            else:
                return self.getTypedRuleContext(MRSParser.AuthenticationRequiredContext,i)


        def itemsPerPage(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.ItemsPerPageContext)
            else:
                return self.getTypedRuleContext(MRSParser.ItemsPerPageContext,i)


        def jsonOptions(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.JsonOptionsContext)
            else:
                return self.getTypedRuleContext(MRSParser.JsonOptionsContext,i)


        def comments(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.CommentsContext)
            else:
                return self.getTypedRuleContext(MRSParser.CommentsContext,i)


        def restViewMediaType(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.RestViewMediaTypeContext)
            else:
                return self.getTypedRuleContext(MRSParser.RestViewMediaTypeContext,i)


        def restViewFormat(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.RestViewFormatContext)
            else:
                return self.getTypedRuleContext(MRSParser.RestViewFormatContext,i)


        def restViewAuthenticationProcedure(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.RestViewAuthenticationProcedureContext)
            else:
                return self.getTypedRuleContext(MRSParser.RestViewAuthenticationProcedureContext,i)


        def getRuleIndex(self):
            return MRSParser.RULE_restDualityViewOptions

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterRestDualityViewOptions" ):
                listener.enterRestDualityViewOptions(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitRestDualityViewOptions" ):
                listener.exitRestDualityViewOptions(self)




    def restDualityViewOptions(self):

        localctx = MRSParser.RestDualityViewOptionsContext(self, self._ctx, self.state)
        self.enterRule(localctx, 50, self.RULE_restDualityViewOptions)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 365 
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while True:
                self.state = 365
                self._errHandler.sync(self)
                la_ = self._interp.adaptivePredict(self._input,34,self._ctx)
                if la_ == 1:
                    self.state = 357
                    self.enabledDisabled()
                    pass

                elif la_ == 2:
                    self.state = 358
                    self.authenticationRequired()
                    pass

                elif la_ == 3:
                    self.state = 359
                    self.itemsPerPage()
                    pass

                elif la_ == 4:
                    self.state = 360
                    self.jsonOptions()
                    pass

                elif la_ == 5:
                    self.state = 361
                    self.comments()
                    pass

                elif la_ == 6:
                    self.state = 362
                    self.restViewMediaType()
                    pass

                elif la_ == 7:
                    self.state = 363
                    self.restViewFormat()
                    pass

                elif la_ == 8:
                    self.state = 364
                    self.restViewAuthenticationProcedure()
                    pass


                self.state = 367 
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if not ((((_la) & ~0x3f) == 0 and ((1 << _la) & 2603222997145747456) != 0)):
                    break

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class RestViewMediaTypeContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def MEDIA_SYMBOL(self):
            return self.getToken(MRSParser.MEDIA_SYMBOL, 0)

        def TYPE_SYMBOL(self):
            return self.getToken(MRSParser.TYPE_SYMBOL, 0)

        def quotedText(self):
            return self.getTypedRuleContext(MRSParser.QuotedTextContext,0)


        def AUTODETECT_SYMBOL(self):
            return self.getToken(MRSParser.AUTODETECT_SYMBOL, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_restViewMediaType

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterRestViewMediaType" ):
                listener.enterRestViewMediaType(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitRestViewMediaType" ):
                listener.exitRestViewMediaType(self)




    def restViewMediaType(self):

        localctx = MRSParser.RestViewMediaTypeContext(self, self._ctx, self.state)
        self.enterRule(localctx, 52, self.RULE_restViewMediaType)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 369
            self.match(MRSParser.MEDIA_SYMBOL)
            self.state = 370
            self.match(MRSParser.TYPE_SYMBOL)
            self.state = 373
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [131, 132]:
                self.state = 371
                self.quotedText()
                pass
            elif token in [60]:
                self.state = 372
                self.match(MRSParser.AUTODETECT_SYMBOL)
                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class RestViewFormatContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def FORMAT_SYMBOL(self):
            return self.getToken(MRSParser.FORMAT_SYMBOL, 0)

        def FEED_SYMBOL(self):
            return self.getToken(MRSParser.FEED_SYMBOL, 0)

        def ITEM_SYMBOL(self):
            return self.getToken(MRSParser.ITEM_SYMBOL, 0)

        def MEDIA_SYMBOL(self):
            return self.getToken(MRSParser.MEDIA_SYMBOL, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_restViewFormat

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterRestViewFormat" ):
                listener.enterRestViewFormat(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitRestViewFormat" ):
                listener.exitRestViewFormat(self)




    def restViewFormat(self):

        localctx = MRSParser.RestViewFormatContext(self, self._ctx, self.state)
        self.enterRule(localctx, 54, self.RULE_restViewFormat)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 375
            self.match(MRSParser.FORMAT_SYMBOL)
            self.state = 376
            _la = self._input.LA(1)
            if not((((_la) & ~0x3f) == 0 and ((1 << _la) & -4323455642275676160) != 0)):
                self._errHandler.recoverInline(self)
            else:
                self._errHandler.reportMatch(self)
                self.consume()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class RestViewAuthenticationProcedureContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def AUTHENTICATION_SYMBOL(self):
            return self.getToken(MRSParser.AUTHENTICATION_SYMBOL, 0)

        def PROCEDURE_SYMBOL(self):
            return self.getToken(MRSParser.PROCEDURE_SYMBOL, 0)

        def qualifiedIdentifier(self):
            return self.getTypedRuleContext(MRSParser.QualifiedIdentifierContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_restViewAuthenticationProcedure

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterRestViewAuthenticationProcedure" ):
                listener.enterRestViewAuthenticationProcedure(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitRestViewAuthenticationProcedure" ):
                listener.exitRestViewAuthenticationProcedure(self)




    def restViewAuthenticationProcedure(self):

        localctx = MRSParser.RestViewAuthenticationProcedureContext(self, self._ctx, self.state)
        self.enterRule(localctx, 56, self.RULE_restViewAuthenticationProcedure)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 378
            self.match(MRSParser.AUTHENTICATION_SYMBOL)
            self.state = 379
            self.match(MRSParser.PROCEDURE_SYMBOL)
            self.state = 380
            self.qualifiedIdentifier()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class CreateRestProcedureStatementContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def CREATE_SYMBOL(self):
            return self.getToken(MRSParser.CREATE_SYMBOL, 0)

        def REST_SYMBOL(self):
            return self.getToken(MRSParser.REST_SYMBOL, 0)

        def PROCEDURE_SYMBOL(self):
            return self.getToken(MRSParser.PROCEDURE_SYMBOL, 0)

        def procedureRequestPath(self):
            return self.getTypedRuleContext(MRSParser.ProcedureRequestPathContext,0)


        def FROM_SYMBOL(self):
            return self.getToken(MRSParser.FROM_SYMBOL, 0)

        def qualifiedIdentifier(self):
            return self.getTypedRuleContext(MRSParser.QualifiedIdentifierContext,0)


        def AS_SYMBOL(self):
            return self.getToken(MRSParser.AS_SYMBOL, 0)

        def restObjectName(self):
            return self.getTypedRuleContext(MRSParser.RestObjectNameContext,0)


        def PARAMETERS_SYMBOL(self):
            return self.getToken(MRSParser.PARAMETERS_SYMBOL, 0)

        def graphGlObj(self):
            return self.getTypedRuleContext(MRSParser.GraphGlObjContext,0)


        def OR_SYMBOL(self):
            return self.getToken(MRSParser.OR_SYMBOL, 0)

        def REPLACE_SYMBOL(self):
            return self.getToken(MRSParser.REPLACE_SYMBOL, 0)

        def serviceSchemaSelector(self):
            return self.getTypedRuleContext(MRSParser.ServiceSchemaSelectorContext,0)


        def restProcedureResult(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.RestProcedureResultContext)
            else:
                return self.getTypedRuleContext(MRSParser.RestProcedureResultContext,i)


        def getRuleIndex(self):
            return MRSParser.RULE_createRestProcedureStatement

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterCreateRestProcedureStatement" ):
                listener.enterCreateRestProcedureStatement(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitCreateRestProcedureStatement" ):
                listener.exitCreateRestProcedureStatement(self)




    def createRestProcedureStatement(self):

        localctx = MRSParser.CreateRestProcedureStatementContext(self, self._ctx, self.state)
        self.enterRule(localctx, 58, self.RULE_createRestProcedureStatement)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 382
            self.match(MRSParser.CREATE_SYMBOL)
            self.state = 385
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==8:
                self.state = 383
                self.match(MRSParser.OR_SYMBOL)
                self.state = 384
                self.match(MRSParser.REPLACE_SYMBOL)


            self.state = 387
            self.match(MRSParser.REST_SYMBOL)
            self.state = 388
            self.match(MRSParser.PROCEDURE_SYMBOL)
            self.state = 389
            self.procedureRequestPath()
            self.state = 391
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==16:
                self.state = 390
                self.serviceSchemaSelector()


            self.state = 393
            self.match(MRSParser.FROM_SYMBOL)
            self.state = 394
            self.qualifiedIdentifier()
            self.state = 395
            self.match(MRSParser.AS_SYMBOL)
            self.state = 396
            self.restObjectName()
            self.state = 397
            self.match(MRSParser.PARAMETERS_SYMBOL)
            self.state = 398
            self.graphGlObj()
            self.state = 402
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while _la==29:
                self.state = 399
                self.restProcedureResult()
                self.state = 404
                self._errHandler.sync(self)
                _la = self._input.LA(1)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class RestProcedureResultContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def RESULT_SYMBOL(self):
            return self.getToken(MRSParser.RESULT_SYMBOL, 0)

        def restResultName(self):
            return self.getTypedRuleContext(MRSParser.RestResultNameContext,0)


        def graphGlObj(self):
            return self.getTypedRuleContext(MRSParser.GraphGlObjContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_restProcedureResult

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterRestProcedureResult" ):
                listener.enterRestProcedureResult(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitRestProcedureResult" ):
                listener.exitRestProcedureResult(self)




    def restProcedureResult(self):

        localctx = MRSParser.RestProcedureResultContext(self, self._ctx, self.state)
        self.enterRule(localctx, 60, self.RULE_restProcedureResult)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 405
            self.match(MRSParser.RESULT_SYMBOL)
            self.state = 406
            self.restResultName()
            self.state = 407
            self.graphGlObj()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class DropRestServiceStatementContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def DROP_SYMBOL(self):
            return self.getToken(MRSParser.DROP_SYMBOL, 0)

        def REST_SYMBOL(self):
            return self.getToken(MRSParser.REST_SYMBOL, 0)

        def SERVICE_SYMBOL(self):
            return self.getToken(MRSParser.SERVICE_SYMBOL, 0)

        def serviceRequestPath(self):
            return self.getTypedRuleContext(MRSParser.ServiceRequestPathContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_dropRestServiceStatement

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterDropRestServiceStatement" ):
                listener.enterDropRestServiceStatement(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitDropRestServiceStatement" ):
                listener.exitDropRestServiceStatement(self)




    def dropRestServiceStatement(self):

        localctx = MRSParser.DropRestServiceStatementContext(self, self._ctx, self.state)
        self.enterRule(localctx, 62, self.RULE_dropRestServiceStatement)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 409
            self.match(MRSParser.DROP_SYMBOL)
            self.state = 410
            self.match(MRSParser.REST_SYMBOL)
            self.state = 411
            self.match(MRSParser.SERVICE_SYMBOL)
            self.state = 412
            self.serviceRequestPath()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class DropRestSchemaStatementContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def DROP_SYMBOL(self):
            return self.getToken(MRSParser.DROP_SYMBOL, 0)

        def REST_SYMBOL(self):
            return self.getToken(MRSParser.REST_SYMBOL, 0)

        def SCHEMA_SYMBOL(self):
            return self.getToken(MRSParser.SCHEMA_SYMBOL, 0)

        def schemaRequestPath(self):
            return self.getTypedRuleContext(MRSParser.SchemaRequestPathContext,0)


        def ON_SYMBOL(self):
            return self.getToken(MRSParser.ON_SYMBOL, 0)

        def serviceRequestPath(self):
            return self.getTypedRuleContext(MRSParser.ServiceRequestPathContext,0)


        def SERVICE_SYMBOL(self):
            return self.getToken(MRSParser.SERVICE_SYMBOL, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_dropRestSchemaStatement

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterDropRestSchemaStatement" ):
                listener.enterDropRestSchemaStatement(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitDropRestSchemaStatement" ):
                listener.exitDropRestSchemaStatement(self)




    def dropRestSchemaStatement(self):

        localctx = MRSParser.DropRestSchemaStatementContext(self, self._ctx, self.state)
        self.enterRule(localctx, 64, self.RULE_dropRestSchemaStatement)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 414
            self.match(MRSParser.DROP_SYMBOL)
            self.state = 415
            self.match(MRSParser.REST_SYMBOL)
            self.state = 416
            self.match(MRSParser.SCHEMA_SYMBOL)
            self.state = 417
            self.schemaRequestPath()
            self.state = 423
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==16:
                self.state = 418
                self.match(MRSParser.ON_SYMBOL)
                self.state = 420
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if _la==15:
                    self.state = 419
                    self.match(MRSParser.SERVICE_SYMBOL)


                self.state = 422
                self.serviceRequestPath()


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class DropRestDualityViewStatementContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def DROP_SYMBOL(self):
            return self.getToken(MRSParser.DROP_SYMBOL, 0)

        def REST_SYMBOL(self):
            return self.getToken(MRSParser.REST_SYMBOL, 0)

        def VIEW_SYMBOL(self):
            return self.getToken(MRSParser.VIEW_SYMBOL, 0)

        def viewRequestPath(self):
            return self.getTypedRuleContext(MRSParser.ViewRequestPathContext,0)


        def RELATIONAL_SYMBOL(self):
            return self.getToken(MRSParser.RELATIONAL_SYMBOL, 0)

        def JSON_SYMBOL(self):
            return self.getToken(MRSParser.JSON_SYMBOL, 0)

        def DUALITY_SYMBOL(self):
            return self.getToken(MRSParser.DUALITY_SYMBOL, 0)

        def serviceSchemaSelector(self):
            return self.getTypedRuleContext(MRSParser.ServiceSchemaSelectorContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_dropRestDualityViewStatement

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterDropRestDualityViewStatement" ):
                listener.enterDropRestDualityViewStatement(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitDropRestDualityViewStatement" ):
                listener.exitDropRestDualityViewStatement(self)




    def dropRestDualityViewStatement(self):

        localctx = MRSParser.DropRestDualityViewStatementContext(self, self._ctx, self.state)
        self.enterRule(localctx, 66, self.RULE_dropRestDualityViewStatement)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 425
            self.match(MRSParser.DROP_SYMBOL)
            self.state = 426
            self.match(MRSParser.REST_SYMBOL)
            self.state = 428
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==22:
                self.state = 427
                self.match(MRSParser.RELATIONAL_SYMBOL)


            self.state = 431
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==21:
                self.state = 430
                self.match(MRSParser.JSON_SYMBOL)


            self.state = 434
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==23:
                self.state = 433
                self.match(MRSParser.DUALITY_SYMBOL)


            self.state = 436
            self.match(MRSParser.VIEW_SYMBOL)
            self.state = 437
            self.viewRequestPath()
            self.state = 439
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==16:
                self.state = 438
                self.serviceSchemaSelector()


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class DropRestProcedureStatementContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def DROP_SYMBOL(self):
            return self.getToken(MRSParser.DROP_SYMBOL, 0)

        def REST_SYMBOL(self):
            return self.getToken(MRSParser.REST_SYMBOL, 0)

        def PROCEDURE_SYMBOL(self):
            return self.getToken(MRSParser.PROCEDURE_SYMBOL, 0)

        def procedureRequestPath(self):
            return self.getTypedRuleContext(MRSParser.ProcedureRequestPathContext,0)


        def serviceSchemaSelector(self):
            return self.getTypedRuleContext(MRSParser.ServiceSchemaSelectorContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_dropRestProcedureStatement

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterDropRestProcedureStatement" ):
                listener.enterDropRestProcedureStatement(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitDropRestProcedureStatement" ):
                listener.exitDropRestProcedureStatement(self)




    def dropRestProcedureStatement(self):

        localctx = MRSParser.DropRestProcedureStatementContext(self, self._ctx, self.state)
        self.enterRule(localctx, 68, self.RULE_dropRestProcedureStatement)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 441
            self.match(MRSParser.DROP_SYMBOL)
            self.state = 442
            self.match(MRSParser.REST_SYMBOL)
            self.state = 443
            self.match(MRSParser.PROCEDURE_SYMBOL)
            self.state = 444
            self.procedureRequestPath()
            self.state = 446
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==16:
                self.state = 445
                self.serviceSchemaSelector()


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class UseStatementContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def USE_SYMBOL(self):
            return self.getToken(MRSParser.USE_SYMBOL, 0)

        def REST_SYMBOL(self):
            return self.getToken(MRSParser.REST_SYMBOL, 0)

        def serviceAndSchemaRequestPaths(self):
            return self.getTypedRuleContext(MRSParser.ServiceAndSchemaRequestPathsContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_useStatement

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterUseStatement" ):
                listener.enterUseStatement(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitUseStatement" ):
                listener.exitUseStatement(self)




    def useStatement(self):

        localctx = MRSParser.UseStatementContext(self, self._ctx, self.state)
        self.enterRule(localctx, 70, self.RULE_useStatement)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 448
            self.match(MRSParser.USE_SYMBOL)
            self.state = 449
            self.match(MRSParser.REST_SYMBOL)
            self.state = 450
            self.serviceAndSchemaRequestPaths()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ServiceAndSchemaRequestPathsContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def SERVICE_SYMBOL(self):
            return self.getToken(MRSParser.SERVICE_SYMBOL, 0)

        def serviceRequestPath(self):
            return self.getTypedRuleContext(MRSParser.ServiceRequestPathContext,0)


        def SCHEMA_SYMBOL(self):
            return self.getToken(MRSParser.SCHEMA_SYMBOL, 0)

        def schemaRequestPath(self):
            return self.getTypedRuleContext(MRSParser.SchemaRequestPathContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_serviceAndSchemaRequestPaths

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterServiceAndSchemaRequestPaths" ):
                listener.enterServiceAndSchemaRequestPaths(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitServiceAndSchemaRequestPaths" ):
                listener.exitServiceAndSchemaRequestPaths(self)




    def serviceAndSchemaRequestPaths(self):

        localctx = MRSParser.ServiceAndSchemaRequestPathsContext(self, self._ctx, self.state)
        self.enterRule(localctx, 72, self.RULE_serviceAndSchemaRequestPaths)
        self._la = 0 # Token type
        try:
            self.state = 460
            self._errHandler.sync(self)
            la_ = self._interp.adaptivePredict(self._input,48,self._ctx)
            if la_ == 1:
                self.enterOuterAlt(localctx, 1)
                self.state = 452
                self.match(MRSParser.SERVICE_SYMBOL)
                self.state = 453
                self.serviceRequestPath()
                pass

            elif la_ == 2:
                self.enterOuterAlt(localctx, 2)
                self.state = 456
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if _la==15:
                    self.state = 454
                    self.match(MRSParser.SERVICE_SYMBOL)
                    self.state = 455
                    self.serviceRequestPath()


                self.state = 458
                self.match(MRSParser.SCHEMA_SYMBOL)
                self.state = 459
                self.schemaRequestPath()
                pass


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ShowRestMetadataStatusStatementContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def SHOW_SYMBOL(self):
            return self.getToken(MRSParser.SHOW_SYMBOL, 0)

        def REST_SYMBOL(self):
            return self.getToken(MRSParser.REST_SYMBOL, 0)

        def STATUS_SYMBOL(self):
            return self.getToken(MRSParser.STATUS_SYMBOL, 0)

        def METADATA_SYMBOL(self):
            return self.getToken(MRSParser.METADATA_SYMBOL, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_showRestMetadataStatusStatement

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterShowRestMetadataStatusStatement" ):
                listener.enterShowRestMetadataStatusStatement(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitShowRestMetadataStatusStatement" ):
                listener.exitShowRestMetadataStatusStatement(self)




    def showRestMetadataStatusStatement(self):

        localctx = MRSParser.ShowRestMetadataStatusStatementContext(self, self._ctx, self.state)
        self.enterRule(localctx, 74, self.RULE_showRestMetadataStatusStatement)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 462
            self.match(MRSParser.SHOW_SYMBOL)
            self.state = 463
            self.match(MRSParser.REST_SYMBOL)
            self.state = 465
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==12:
                self.state = 464
                self.match(MRSParser.METADATA_SYMBOL)


            self.state = 467
            self.match(MRSParser.STATUS_SYMBOL)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ShowRestServicesStatementContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def SHOW_SYMBOL(self):
            return self.getToken(MRSParser.SHOW_SYMBOL, 0)

        def REST_SYMBOL(self):
            return self.getToken(MRSParser.REST_SYMBOL, 0)

        def SERVICES_SYMBOL(self):
            return self.getToken(MRSParser.SERVICES_SYMBOL, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_showRestServicesStatement

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterShowRestServicesStatement" ):
                listener.enterShowRestServicesStatement(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitShowRestServicesStatement" ):
                listener.exitShowRestServicesStatement(self)




    def showRestServicesStatement(self):

        localctx = MRSParser.ShowRestServicesStatementContext(self, self._ctx, self.state)
        self.enterRule(localctx, 76, self.RULE_showRestServicesStatement)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 469
            self.match(MRSParser.SHOW_SYMBOL)
            self.state = 470
            self.match(MRSParser.REST_SYMBOL)
            self.state = 471
            self.match(MRSParser.SERVICES_SYMBOL)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ShowRestSchemasStatementContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def SHOW_SYMBOL(self):
            return self.getToken(MRSParser.SHOW_SYMBOL, 0)

        def REST_SYMBOL(self):
            return self.getToken(MRSParser.REST_SYMBOL, 0)

        def SCHEMAS_SYMBOL(self):
            return self.getToken(MRSParser.SCHEMAS_SYMBOL, 0)

        def serviceRequestPath(self):
            return self.getTypedRuleContext(MRSParser.ServiceRequestPathContext,0)


        def IN_SYMBOL(self):
            return self.getToken(MRSParser.IN_SYMBOL, 0)

        def FROM_SYMBOL(self):
            return self.getToken(MRSParser.FROM_SYMBOL, 0)

        def SERVICE_SYMBOL(self):
            return self.getToken(MRSParser.SERVICE_SYMBOL, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_showRestSchemasStatement

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterShowRestSchemasStatement" ):
                listener.enterShowRestSchemasStatement(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitShowRestSchemasStatement" ):
                listener.exitShowRestSchemasStatement(self)




    def showRestSchemasStatement(self):

        localctx = MRSParser.ShowRestSchemasStatementContext(self, self._ctx, self.state)
        self.enterRule(localctx, 78, self.RULE_showRestSchemasStatement)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 473
            self.match(MRSParser.SHOW_SYMBOL)
            self.state = 474
            self.match(MRSParser.REST_SYMBOL)
            self.state = 475
            self.match(MRSParser.SCHEMAS_SYMBOL)
            self.state = 481
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==17 or _la==18:
                self.state = 476
                _la = self._input.LA(1)
                if not(_la==17 or _la==18):
                    self._errHandler.recoverInline(self)
                else:
                    self._errHandler.reportMatch(self)
                    self.consume()
                self.state = 478
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if _la==15:
                    self.state = 477
                    self.match(MRSParser.SERVICE_SYMBOL)


                self.state = 480
                self.serviceRequestPath()


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ShowRestViewsStatementContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def SHOW_SYMBOL(self):
            return self.getToken(MRSParser.SHOW_SYMBOL, 0)

        def REST_SYMBOL(self):
            return self.getToken(MRSParser.REST_SYMBOL, 0)

        def VIEWS_SYMBOL(self):
            return self.getToken(MRSParser.VIEWS_SYMBOL, 0)

        def RELATIONAL_SYMBOL(self):
            return self.getToken(MRSParser.RELATIONAL_SYMBOL, 0)

        def JSON_SYMBOL(self):
            return self.getToken(MRSParser.JSON_SYMBOL, 0)

        def DUALITY_SYMBOL(self):
            return self.getToken(MRSParser.DUALITY_SYMBOL, 0)

        def serviceAndSchemaRequestPaths(self):
            return self.getTypedRuleContext(MRSParser.ServiceAndSchemaRequestPathsContext,0)


        def IN_SYMBOL(self):
            return self.getToken(MRSParser.IN_SYMBOL, 0)

        def FROM_SYMBOL(self):
            return self.getToken(MRSParser.FROM_SYMBOL, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_showRestViewsStatement

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterShowRestViewsStatement" ):
                listener.enterShowRestViewsStatement(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitShowRestViewsStatement" ):
                listener.exitShowRestViewsStatement(self)




    def showRestViewsStatement(self):

        localctx = MRSParser.ShowRestViewsStatementContext(self, self._ctx, self.state)
        self.enterRule(localctx, 80, self.RULE_showRestViewsStatement)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 483
            self.match(MRSParser.SHOW_SYMBOL)
            self.state = 484
            self.match(MRSParser.REST_SYMBOL)
            self.state = 486
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==22:
                self.state = 485
                self.match(MRSParser.RELATIONAL_SYMBOL)


            self.state = 489
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==21:
                self.state = 488
                self.match(MRSParser.JSON_SYMBOL)


            self.state = 492
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==23:
                self.state = 491
                self.match(MRSParser.DUALITY_SYMBOL)


            self.state = 494
            self.match(MRSParser.VIEWS_SYMBOL)
            self.state = 497
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==17 or _la==18:
                self.state = 495
                _la = self._input.LA(1)
                if not(_la==17 or _la==18):
                    self._errHandler.recoverInline(self)
                else:
                    self._errHandler.reportMatch(self)
                    self.consume()
                self.state = 496
                self.serviceAndSchemaRequestPaths()


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ShowRestProceduresStatementContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def SHOW_SYMBOL(self):
            return self.getToken(MRSParser.SHOW_SYMBOL, 0)

        def REST_SYMBOL(self):
            return self.getToken(MRSParser.REST_SYMBOL, 0)

        def PROCEDURES_SYMBOL(self):
            return self.getToken(MRSParser.PROCEDURES_SYMBOL, 0)

        def serviceAndSchemaRequestPaths(self):
            return self.getTypedRuleContext(MRSParser.ServiceAndSchemaRequestPathsContext,0)


        def IN_SYMBOL(self):
            return self.getToken(MRSParser.IN_SYMBOL, 0)

        def FROM_SYMBOL(self):
            return self.getToken(MRSParser.FROM_SYMBOL, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_showRestProceduresStatement

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterShowRestProceduresStatement" ):
                listener.enterShowRestProceduresStatement(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitShowRestProceduresStatement" ):
                listener.exitShowRestProceduresStatement(self)




    def showRestProceduresStatement(self):

        localctx = MRSParser.ShowRestProceduresStatementContext(self, self._ctx, self.state)
        self.enterRule(localctx, 82, self.RULE_showRestProceduresStatement)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 499
            self.match(MRSParser.SHOW_SYMBOL)
            self.state = 500
            self.match(MRSParser.REST_SYMBOL)
            self.state = 501
            self.match(MRSParser.PROCEDURES_SYMBOL)
            self.state = 504
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==17 or _la==18:
                self.state = 502
                _la = self._input.LA(1)
                if not(_la==17 or _la==18):
                    self._errHandler.recoverInline(self)
                else:
                    self._errHandler.reportMatch(self)
                    self.consume()
                self.state = 503
                self.serviceAndSchemaRequestPaths()


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ServiceRequestPathContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def requestPathIdentifier(self):
            return self.getTypedRuleContext(MRSParser.RequestPathIdentifierContext,0)


        def hostAndPortIdentifier(self):
            return self.getTypedRuleContext(MRSParser.HostAndPortIdentifierContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_serviceRequestPath

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterServiceRequestPath" ):
                listener.enterServiceRequestPath(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitServiceRequestPath" ):
                listener.exitServiceRequestPath(self)




    def serviceRequestPath(self):

        localctx = MRSParser.ServiceRequestPathContext(self, self._ctx, self.state)
        self.enterRule(localctx, 84, self.RULE_serviceRequestPath)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 507
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==128 or _la==130:
                self.state = 506
                self.hostAndPortIdentifier()


            self.state = 509
            self.requestPathIdentifier()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class SchemaNameContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def identifier(self):
            return self.getTypedRuleContext(MRSParser.IdentifierContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_schemaName

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterSchemaName" ):
                listener.enterSchemaName(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitSchemaName" ):
                listener.exitSchemaName(self)




    def schemaName(self):

        localctx = MRSParser.SchemaNameContext(self, self._ctx, self.state)
        self.enterRule(localctx, 86, self.RULE_schemaName)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 511
            self.identifier()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class SchemaRequestPathContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def requestPathIdentifier(self):
            return self.getTypedRuleContext(MRSParser.RequestPathIdentifierContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_schemaRequestPath

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterSchemaRequestPath" ):
                listener.enterSchemaRequestPath(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitSchemaRequestPath" ):
                listener.exitSchemaRequestPath(self)




    def schemaRequestPath(self):

        localctx = MRSParser.SchemaRequestPathContext(self, self._ctx, self.state)
        self.enterRule(localctx, 88, self.RULE_schemaRequestPath)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 513
            self.requestPathIdentifier()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ViewNameContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def identifier(self):
            return self.getTypedRuleContext(MRSParser.IdentifierContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_viewName

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterViewName" ):
                listener.enterViewName(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitViewName" ):
                listener.exitViewName(self)




    def viewName(self):

        localctx = MRSParser.ViewNameContext(self, self._ctx, self.state)
        self.enterRule(localctx, 90, self.RULE_viewName)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 515
            self.identifier()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ViewRequestPathContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def requestPathIdentifier(self):
            return self.getTypedRuleContext(MRSParser.RequestPathIdentifierContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_viewRequestPath

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterViewRequestPath" ):
                listener.enterViewRequestPath(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitViewRequestPath" ):
                listener.exitViewRequestPath(self)




    def viewRequestPath(self):

        localctx = MRSParser.ViewRequestPathContext(self, self._ctx, self.state)
        self.enterRule(localctx, 92, self.RULE_viewRequestPath)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 517
            self.requestPathIdentifier()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class RestObjectNameContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def identifier(self):
            return self.getTypedRuleContext(MRSParser.IdentifierContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_restObjectName

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterRestObjectName" ):
                listener.enterRestObjectName(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitRestObjectName" ):
                listener.exitRestObjectName(self)




    def restObjectName(self):

        localctx = MRSParser.RestObjectNameContext(self, self._ctx, self.state)
        self.enterRule(localctx, 94, self.RULE_restObjectName)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 519
            self.identifier()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class RestResultNameContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def identifier(self):
            return self.getTypedRuleContext(MRSParser.IdentifierContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_restResultName

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterRestResultName" ):
                listener.enterRestResultName(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitRestResultName" ):
                listener.exitRestResultName(self)




    def restResultName(self):

        localctx = MRSParser.RestResultNameContext(self, self._ctx, self.state)
        self.enterRule(localctx, 96, self.RULE_restResultName)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 521
            self.identifier()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ProcedureNameContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def identifier(self):
            return self.getTypedRuleContext(MRSParser.IdentifierContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_procedureName

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterProcedureName" ):
                listener.enterProcedureName(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitProcedureName" ):
                listener.exitProcedureName(self)




    def procedureName(self):

        localctx = MRSParser.ProcedureNameContext(self, self._ctx, self.state)
        self.enterRule(localctx, 98, self.RULE_procedureName)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 523
            self.identifier()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ProcedureRequestPathContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def requestPathIdentifier(self):
            return self.getTypedRuleContext(MRSParser.RequestPathIdentifierContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_procedureRequestPath

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterProcedureRequestPath" ):
                listener.enterProcedureRequestPath(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitProcedureRequestPath" ):
                listener.exitProcedureRequestPath(self)




    def procedureRequestPath(self):

        localctx = MRSParser.ProcedureRequestPathContext(self, self._ctx, self.state)
        self.enterRule(localctx, 100, self.RULE_procedureRequestPath)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 525
            self.requestPathIdentifier()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class PureIdentifierContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def IDENTIFIER(self):
            return self.getToken(MRSParser.IDENTIFIER, 0)

        def BACK_TICK_QUOTED_ID(self):
            return self.getToken(MRSParser.BACK_TICK_QUOTED_ID, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_pureIdentifier

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterPureIdentifier" ):
                listener.enterPureIdentifier(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitPureIdentifier" ):
                listener.exitPureIdentifier(self)




    def pureIdentifier(self):

        localctx = MRSParser.PureIdentifierContext(self, self._ctx, self.state)
        self.enterRule(localctx, 102, self.RULE_pureIdentifier)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 527
            _la = self._input.LA(1)
            if not(_la==128 or _la==130):
                self._errHandler.recoverInline(self)
            else:
                self._errHandler.reportMatch(self)
                self.consume()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class IdentifierContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def pureIdentifier(self):
            return self.getTypedRuleContext(MRSParser.PureIdentifierContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_identifier

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterIdentifier" ):
                listener.enterIdentifier(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitIdentifier" ):
                listener.exitIdentifier(self)




    def identifier(self):

        localctx = MRSParser.IdentifierContext(self, self._ctx, self.state)
        self.enterRule(localctx, 104, self.RULE_identifier)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 529
            self.pureIdentifier()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class IdentifierListContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def identifier(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.IdentifierContext)
            else:
                return self.getTypedRuleContext(MRSParser.IdentifierContext,i)


        def COMMA_SYMBOL(self, i:int=None):
            if i is None:
                return self.getTokens(MRSParser.COMMA_SYMBOL)
            else:
                return self.getToken(MRSParser.COMMA_SYMBOL, i)

        def getRuleIndex(self):
            return MRSParser.RULE_identifierList

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterIdentifierList" ):
                listener.enterIdentifierList(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitIdentifierList" ):
                listener.exitIdentifierList(self)




    def identifierList(self):

        localctx = MRSParser.IdentifierListContext(self, self._ctx, self.state)
        self.enterRule(localctx, 106, self.RULE_identifierList)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 531
            self.identifier()
            self.state = 536
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while _la==106:
                self.state = 532
                self.match(MRSParser.COMMA_SYMBOL)
                self.state = 533
                self.identifier()
                self.state = 538
                self._errHandler.sync(self)
                _la = self._input.LA(1)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class IdentifierListWithParenthesesContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def OPEN_PAR_SYMBOL(self):
            return self.getToken(MRSParser.OPEN_PAR_SYMBOL, 0)

        def identifierList(self):
            return self.getTypedRuleContext(MRSParser.IdentifierListContext,0)


        def CLOSE_PAR_SYMBOL(self):
            return self.getToken(MRSParser.CLOSE_PAR_SYMBOL, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_identifierListWithParentheses

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterIdentifierListWithParentheses" ):
                listener.enterIdentifierListWithParentheses(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitIdentifierListWithParentheses" ):
                listener.exitIdentifierListWithParentheses(self)




    def identifierListWithParentheses(self):

        localctx = MRSParser.IdentifierListWithParenthesesContext(self, self._ctx, self.state)
        self.enterRule(localctx, 108, self.RULE_identifierListWithParentheses)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 539
            self.match(MRSParser.OPEN_PAR_SYMBOL)
            self.state = 540
            self.identifierList()
            self.state = 541
            self.match(MRSParser.CLOSE_PAR_SYMBOL)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class QualifiedIdentifierContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def identifier(self):
            return self.getTypedRuleContext(MRSParser.IdentifierContext,0)


        def dotIdentifier(self):
            return self.getTypedRuleContext(MRSParser.DotIdentifierContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_qualifiedIdentifier

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterQualifiedIdentifier" ):
                listener.enterQualifiedIdentifier(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitQualifiedIdentifier" ):
                listener.exitQualifiedIdentifier(self)




    def qualifiedIdentifier(self):

        localctx = MRSParser.QualifiedIdentifierContext(self, self._ctx, self.state)
        self.enterRule(localctx, 110, self.RULE_qualifiedIdentifier)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 543
            self.identifier()
            self.state = 545
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==105:
                self.state = 544
                self.dotIdentifier()


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class SimpleIdentifierContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def identifier(self):
            return self.getTypedRuleContext(MRSParser.IdentifierContext,0)


        def dotIdentifier(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.DotIdentifierContext)
            else:
                return self.getTypedRuleContext(MRSParser.DotIdentifierContext,i)


        def getRuleIndex(self):
            return MRSParser.RULE_simpleIdentifier

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterSimpleIdentifier" ):
                listener.enterSimpleIdentifier(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitSimpleIdentifier" ):
                listener.exitSimpleIdentifier(self)




    def simpleIdentifier(self):

        localctx = MRSParser.SimpleIdentifierContext(self, self._ctx, self.state)
        self.enterRule(localctx, 112, self.RULE_simpleIdentifier)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 547
            self.identifier()
            self.state = 552
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==105:
                self.state = 548
                self.dotIdentifier()
                self.state = 550
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if _la==105:
                    self.state = 549
                    self.dotIdentifier()




        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class DotIdentifierContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def DOT_SYMBOL(self):
            return self.getToken(MRSParser.DOT_SYMBOL, 0)

        def identifier(self):
            return self.getTypedRuleContext(MRSParser.IdentifierContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_dotIdentifier

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterDotIdentifier" ):
                listener.enterDotIdentifier(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitDotIdentifier" ):
                listener.exitDotIdentifier(self)




    def dotIdentifier(self):

        localctx = MRSParser.DotIdentifierContext(self, self._ctx, self.state)
        self.enterRule(localctx, 114, self.RULE_dotIdentifier)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 554
            self.match(MRSParser.DOT_SYMBOL)
            self.state = 555
            self.identifier()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class DottedIdentifierContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def simpleIdentifier(self):
            return self.getTypedRuleContext(MRSParser.SimpleIdentifierContext,0)


        def identifier(self):
            return self.getTypedRuleContext(MRSParser.IdentifierContext,0)


        def dotIdentifier(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.DotIdentifierContext)
            else:
                return self.getTypedRuleContext(MRSParser.DotIdentifierContext,i)


        def getRuleIndex(self):
            return MRSParser.RULE_dottedIdentifier

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterDottedIdentifier" ):
                listener.enterDottedIdentifier(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitDottedIdentifier" ):
                listener.exitDottedIdentifier(self)




    def dottedIdentifier(self):

        localctx = MRSParser.DottedIdentifierContext(self, self._ctx, self.state)
        self.enterRule(localctx, 116, self.RULE_dottedIdentifier)
        self._la = 0 # Token type
        try:
            self.state = 565
            self._errHandler.sync(self)
            la_ = self._interp.adaptivePredict(self._input,63,self._ctx)
            if la_ == 1:
                self.enterOuterAlt(localctx, 1)
                self.state = 557
                self.simpleIdentifier()
                pass

            elif la_ == 2:
                self.enterOuterAlt(localctx, 2)
                self.state = 558
                self.identifier()
                self.state = 562
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                while _la==105:
                    self.state = 559
                    self.dotIdentifier()
                    self.state = 564
                    self._errHandler.sync(self)
                    _la = self._input.LA(1)

                pass


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class HostAndPortIdentifierContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def dottedIdentifier(self):
            return self.getTypedRuleContext(MRSParser.DottedIdentifierContext,0)


        def COLON_SYMBOL(self):
            return self.getToken(MRSParser.COLON_SYMBOL, 0)

        def INT_NUMBER(self):
            return self.getToken(MRSParser.INT_NUMBER, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_hostAndPortIdentifier

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterHostAndPortIdentifier" ):
                listener.enterHostAndPortIdentifier(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitHostAndPortIdentifier" ):
                listener.exitHostAndPortIdentifier(self)




    def hostAndPortIdentifier(self):

        localctx = MRSParser.HostAndPortIdentifierContext(self, self._ctx, self.state)
        self.enterRule(localctx, 118, self.RULE_hostAndPortIdentifier)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 567
            self.dottedIdentifier()
            self.state = 570
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==108:
                self.state = 568
                self.match(MRSParser.COLON_SYMBOL)
                self.state = 569
                self.match(MRSParser.INT_NUMBER)


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class RequestPathIdentifierContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def DIV_OPERATOR(self, i:int=None):
            if i is None:
                return self.getTokens(MRSParser.DIV_OPERATOR)
            else:
                return self.getToken(MRSParser.DIV_OPERATOR, i)

        def dottedIdentifier(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.DottedIdentifierContext)
            else:
                return self.getTypedRuleContext(MRSParser.DottedIdentifierContext,i)


        def getRuleIndex(self):
            return MRSParser.RULE_requestPathIdentifier

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterRequestPathIdentifier" ):
                listener.enterRequestPathIdentifier(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitRequestPathIdentifier" ):
                listener.exitRequestPathIdentifier(self)




    def requestPathIdentifier(self):

        localctx = MRSParser.RequestPathIdentifierContext(self, self._ctx, self.state)
        self.enterRule(localctx, 120, self.RULE_requestPathIdentifier)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 572
            self.match(MRSParser.DIV_OPERATOR)
            self.state = 573
            self.dottedIdentifier()
            self.state = 576
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==94:
                self.state = 574
                self.match(MRSParser.DIV_OPERATOR)
                self.state = 575
                self.dottedIdentifier()


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class QuotedTextContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def DOUBLE_QUOTED_TEXT(self):
            return self.getToken(MRSParser.DOUBLE_QUOTED_TEXT, 0)

        def SINGLE_QUOTED_TEXT(self):
            return self.getToken(MRSParser.SINGLE_QUOTED_TEXT, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_quotedText

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterQuotedText" ):
                listener.enterQuotedText(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitQuotedText" ):
                listener.exitQuotedText(self)




    def quotedText(self):

        localctx = MRSParser.QuotedTextContext(self, self._ctx, self.state)
        self.enterRule(localctx, 122, self.RULE_quotedText)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 578
            _la = self._input.LA(1)
            if not(_la==131 or _la==132):
                self._errHandler.recoverInline(self)
            else:
                self._errHandler.reportMatch(self)
                self.consume()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class JsonObjContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def OPEN_CURLY_SYMBOL(self):
            return self.getToken(MRSParser.OPEN_CURLY_SYMBOL, 0)

        def jsonPair(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.JsonPairContext)
            else:
                return self.getTypedRuleContext(MRSParser.JsonPairContext,i)


        def CLOSE_CURLY_SYMBOL(self):
            return self.getToken(MRSParser.CLOSE_CURLY_SYMBOL, 0)

        def COMMA_SYMBOL(self, i:int=None):
            if i is None:
                return self.getTokens(MRSParser.COMMA_SYMBOL)
            else:
                return self.getToken(MRSParser.COMMA_SYMBOL, i)

        def getRuleIndex(self):
            return MRSParser.RULE_jsonObj

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterJsonObj" ):
                listener.enterJsonObj(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitJsonObj" ):
                listener.exitJsonObj(self)




    def jsonObj(self):

        localctx = MRSParser.JsonObjContext(self, self._ctx, self.state)
        self.enterRule(localctx, 124, self.RULE_jsonObj)
        self._la = 0 # Token type
        try:
            self.state = 593
            self._errHandler.sync(self)
            la_ = self._interp.adaptivePredict(self._input,67,self._ctx)
            if la_ == 1:
                self.enterOuterAlt(localctx, 1)
                self.state = 580
                self.match(MRSParser.OPEN_CURLY_SYMBOL)
                self.state = 581
                self.jsonPair()
                self.state = 586
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                while _la==106:
                    self.state = 582
                    self.match(MRSParser.COMMA_SYMBOL)
                    self.state = 583
                    self.jsonPair()
                    self.state = 588
                    self._errHandler.sync(self)
                    _la = self._input.LA(1)

                self.state = 589
                self.match(MRSParser.CLOSE_CURLY_SYMBOL)
                pass

            elif la_ == 2:
                self.enterOuterAlt(localctx, 2)
                self.state = 591
                self.match(MRSParser.OPEN_CURLY_SYMBOL)
                self.state = 592
                self.match(MRSParser.CLOSE_CURLY_SYMBOL)
                pass


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class JsonPairContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def COLON_SYMBOL(self):
            return self.getToken(MRSParser.COLON_SYMBOL, 0)

        def jsonValue(self):
            return self.getTypedRuleContext(MRSParser.JsonValueContext,0)


        def JSON_STRING(self):
            return self.getToken(MRSParser.JSON_STRING, 0)

        def DOUBLE_QUOTED_TEXT(self):
            return self.getToken(MRSParser.DOUBLE_QUOTED_TEXT, 0)

        def getRuleIndex(self):
            return MRSParser.RULE_jsonPair

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterJsonPair" ):
                listener.enterJsonPair(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitJsonPair" ):
                listener.exitJsonPair(self)




    def jsonPair(self):

        localctx = MRSParser.JsonPairContext(self, self._ctx, self.state)
        self.enterRule(localctx, 126, self.RULE_jsonPair)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 595
            _la = self._input.LA(1)
            if not(_la==131 or _la==136):
                self._errHandler.recoverInline(self)
            else:
                self._errHandler.reportMatch(self)
                self.consume()
            self.state = 596
            self.match(MRSParser.COLON_SYMBOL)
            self.state = 597
            self.jsonValue()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class JsonArrContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def jsonValue(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.JsonValueContext)
            else:
                return self.getTypedRuleContext(MRSParser.JsonValueContext,i)


        def COMMA_SYMBOL(self, i:int=None):
            if i is None:
                return self.getTokens(MRSParser.COMMA_SYMBOL)
            else:
                return self.getToken(MRSParser.COMMA_SYMBOL, i)

        def getRuleIndex(self):
            return MRSParser.RULE_jsonArr

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterJsonArr" ):
                listener.enterJsonArr(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitJsonArr" ):
                listener.exitJsonArr(self)




    def jsonArr(self):

        localctx = MRSParser.JsonArrContext(self, self._ctx, self.state)
        self.enterRule(localctx, 128, self.RULE_jsonArr)
        self._la = 0 # Token type
        try:
            self.state = 612
            self._errHandler.sync(self)
            la_ = self._interp.adaptivePredict(self._input,69,self._ctx)
            if la_ == 1:
                self.enterOuterAlt(localctx, 1)
                self.state = 599
                self.match(MRSParser.T__0)
                self.state = 600
                self.jsonValue()
                self.state = 605
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                while _la==106:
                    self.state = 601
                    self.match(MRSParser.COMMA_SYMBOL)
                    self.state = 602
                    self.jsonValue()
                    self.state = 607
                    self._errHandler.sync(self)
                    _la = self._input.LA(1)

                self.state = 608
                self.match(MRSParser.T__1)
                pass

            elif la_ == 2:
                self.enterOuterAlt(localctx, 2)
                self.state = 610
                self.match(MRSParser.T__0)
                self.state = 611
                self.match(MRSParser.T__1)
                pass


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class JsonValueContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def JSON_STRING(self):
            return self.getToken(MRSParser.JSON_STRING, 0)

        def DOUBLE_QUOTED_TEXT(self):
            return self.getToken(MRSParser.DOUBLE_QUOTED_TEXT, 0)

        def JSON_NUMBER(self):
            return self.getToken(MRSParser.JSON_NUMBER, 0)

        def INT_NUMBER(self):
            return self.getToken(MRSParser.INT_NUMBER, 0)

        def jsonObj(self):
            return self.getTypedRuleContext(MRSParser.JsonObjContext,0)


        def jsonArr(self):
            return self.getTypedRuleContext(MRSParser.JsonArrContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_jsonValue

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterJsonValue" ):
                listener.enterJsonValue(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitJsonValue" ):
                listener.exitJsonValue(self)




    def jsonValue(self):

        localctx = MRSParser.JsonValueContext(self, self._ctx, self.state)
        self.enterRule(localctx, 130, self.RULE_jsonValue)
        try:
            self.state = 623
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [136]:
                self.enterOuterAlt(localctx, 1)
                self.state = 614
                self.match(MRSParser.JSON_STRING)
                pass
            elif token in [131]:
                self.enterOuterAlt(localctx, 2)
                self.state = 615
                self.match(MRSParser.DOUBLE_QUOTED_TEXT)
                pass
            elif token in [137]:
                self.enterOuterAlt(localctx, 3)
                self.state = 616
                self.match(MRSParser.JSON_NUMBER)
                pass
            elif token in [123]:
                self.enterOuterAlt(localctx, 4)
                self.state = 617
                self.match(MRSParser.INT_NUMBER)
                pass
            elif token in [111]:
                self.enterOuterAlt(localctx, 5)
                self.state = 618
                self.jsonObj()
                pass
            elif token in [1]:
                self.enterOuterAlt(localctx, 6)
                self.state = 619
                self.jsonArr()
                pass
            elif token in [3]:
                self.enterOuterAlt(localctx, 7)
                self.state = 620
                self.match(MRSParser.T__2)
                pass
            elif token in [4]:
                self.enterOuterAlt(localctx, 8)
                self.state = 621
                self.match(MRSParser.T__3)
                pass
            elif token in [5]:
                self.enterOuterAlt(localctx, 9)
                self.state = 622
                self.match(MRSParser.T__4)
                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class GraphGlObjContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def OPEN_CURLY_SYMBOL(self):
            return self.getToken(MRSParser.OPEN_CURLY_SYMBOL, 0)

        def graphGlPair(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(MRSParser.GraphGlPairContext)
            else:
                return self.getTypedRuleContext(MRSParser.GraphGlPairContext,i)


        def CLOSE_CURLY_SYMBOL(self):
            return self.getToken(MRSParser.CLOSE_CURLY_SYMBOL, 0)

        def COMMA_SYMBOL(self, i:int=None):
            if i is None:
                return self.getTokens(MRSParser.COMMA_SYMBOL)
            else:
                return self.getToken(MRSParser.COMMA_SYMBOL, i)

        def getRuleIndex(self):
            return MRSParser.RULE_graphGlObj

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterGraphGlObj" ):
                listener.enterGraphGlObj(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitGraphGlObj" ):
                listener.exitGraphGlObj(self)




    def graphGlObj(self):

        localctx = MRSParser.GraphGlObjContext(self, self._ctx, self.state)
        self.enterRule(localctx, 132, self.RULE_graphGlObj)
        self._la = 0 # Token type
        try:
            self.state = 638
            self._errHandler.sync(self)
            la_ = self._interp.adaptivePredict(self._input,72,self._ctx)
            if la_ == 1:
                self.enterOuterAlt(localctx, 1)
                self.state = 625
                self.match(MRSParser.OPEN_CURLY_SYMBOL)
                self.state = 626
                self.graphGlPair()
                self.state = 631
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                while _la==106:
                    self.state = 627
                    self.match(MRSParser.COMMA_SYMBOL)
                    self.state = 628
                    self.graphGlPair()
                    self.state = 633
                    self._errHandler.sync(self)
                    _la = self._input.LA(1)

                self.state = 634
                self.match(MRSParser.CLOSE_CURLY_SYMBOL)
                pass

            elif la_ == 2:
                self.enterOuterAlt(localctx, 2)
                self.state = 636
                self.match(MRSParser.OPEN_CURLY_SYMBOL)
                self.state = 637
                self.match(MRSParser.CLOSE_CURLY_SYMBOL)
                pass


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class GraphGlCrudOptionsContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def AT_SELECT_SYMBOL(self, i:int=None):
            if i is None:
                return self.getTokens(MRSParser.AT_SELECT_SYMBOL)
            else:
                return self.getToken(MRSParser.AT_SELECT_SYMBOL, i)

        def AT_NOSELECT_SYMBOL(self, i:int=None):
            if i is None:
                return self.getTokens(MRSParser.AT_NOSELECT_SYMBOL)
            else:
                return self.getToken(MRSParser.AT_NOSELECT_SYMBOL, i)

        def AT_INSERT_SYMBOL(self, i:int=None):
            if i is None:
                return self.getTokens(MRSParser.AT_INSERT_SYMBOL)
            else:
                return self.getToken(MRSParser.AT_INSERT_SYMBOL, i)

        def AT_NOINSERT_SYMBOL(self, i:int=None):
            if i is None:
                return self.getTokens(MRSParser.AT_NOINSERT_SYMBOL)
            else:
                return self.getToken(MRSParser.AT_NOINSERT_SYMBOL, i)

        def AT_UPDATE_SYMBOL(self, i:int=None):
            if i is None:
                return self.getTokens(MRSParser.AT_UPDATE_SYMBOL)
            else:
                return self.getToken(MRSParser.AT_UPDATE_SYMBOL, i)

        def AT_NOUPDATE_SYMBOL(self, i:int=None):
            if i is None:
                return self.getTokens(MRSParser.AT_NOUPDATE_SYMBOL)
            else:
                return self.getToken(MRSParser.AT_NOUPDATE_SYMBOL, i)

        def AT_DELETE_SYMBOL(self, i:int=None):
            if i is None:
                return self.getTokens(MRSParser.AT_DELETE_SYMBOL)
            else:
                return self.getToken(MRSParser.AT_DELETE_SYMBOL, i)

        def AT_NODELETE_SYMBOL(self, i:int=None):
            if i is None:
                return self.getTokens(MRSParser.AT_NODELETE_SYMBOL)
            else:
                return self.getToken(MRSParser.AT_NODELETE_SYMBOL, i)

        def getRuleIndex(self):
            return MRSParser.RULE_graphGlCrudOptions

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterGraphGlCrudOptions" ):
                listener.enterGraphGlCrudOptions(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitGraphGlCrudOptions" ):
                listener.exitGraphGlCrudOptions(self)




    def graphGlCrudOptions(self):

        localctx = MRSParser.GraphGlCrudOptionsContext(self, self._ctx, self.state)
        self.enterRule(localctx, 134, self.RULE_graphGlCrudOptions)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 641 
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while True:
                self.state = 640
                _la = self._input.LA(1)
                if not(((((_la - 69)) & ~0x3f) == 0 and ((1 << (_la - 69)) & 16257) != 0)):
                    self._errHandler.recoverInline(self)
                else:
                    self._errHandler.reportMatch(self)
                    self.consume()
                self.state = 643 
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if not (((((_la - 69)) & ~0x3f) == 0 and ((1 << (_la - 69)) & 16257) != 0)):
                    break

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class GraphGlPairContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def graphKeyValue(self):
            return self.getTypedRuleContext(MRSParser.GraphKeyValueContext,0)


        def COLON_SYMBOL(self):
            return self.getToken(MRSParser.COLON_SYMBOL, 0)

        def qualifiedIdentifier(self):
            return self.getTypedRuleContext(MRSParser.QualifiedIdentifierContext,0)


        def AT_IN_SYMBOL(self):
            return self.getToken(MRSParser.AT_IN_SYMBOL, 0)

        def AT_OUT_SYMBOL(self):
            return self.getToken(MRSParser.AT_OUT_SYMBOL, 0)

        def AT_INOUT_SYMBOL(self):
            return self.getToken(MRSParser.AT_INOUT_SYMBOL, 0)

        def AT_NOCHECK_SYMBOL(self):
            return self.getToken(MRSParser.AT_NOCHECK_SYMBOL, 0)

        def AT_SORTABLE_SYMBOL(self):
            return self.getToken(MRSParser.AT_SORTABLE_SYMBOL, 0)

        def AT_NOFILTERING_SYMBOL(self):
            return self.getToken(MRSParser.AT_NOFILTERING_SYMBOL, 0)

        def AT_ROWOWNERSHIP_SYMBOL(self):
            return self.getToken(MRSParser.AT_ROWOWNERSHIP_SYMBOL, 0)

        def AT_UNNEST_SYMBOL(self):
            return self.getToken(MRSParser.AT_UNNEST_SYMBOL, 0)

        def graphGlCrudOptions(self):
            return self.getTypedRuleContext(MRSParser.GraphGlCrudOptionsContext,0)


        def graphGlObj(self):
            return self.getTypedRuleContext(MRSParser.GraphGlObjContext,0)


        def AT_REDUCETO_SYMBOL(self):
            return self.getToken(MRSParser.AT_REDUCETO_SYMBOL, 0)

        def OPEN_PAR_SYMBOL(self):
            return self.getToken(MRSParser.OPEN_PAR_SYMBOL, 0)

        def graphGlReduceToValue(self):
            return self.getTypedRuleContext(MRSParser.GraphGlReduceToValueContext,0)


        def CLOSE_PAR_SYMBOL(self):
            return self.getToken(MRSParser.CLOSE_PAR_SYMBOL, 0)

        def AT_DATATYPE_SYMBOL(self):
            return self.getToken(MRSParser.AT_DATATYPE_SYMBOL, 0)

        def graphGlDatatypeValue(self):
            return self.getTypedRuleContext(MRSParser.GraphGlDatatypeValueContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_graphGlPair

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterGraphGlPair" ):
                listener.enterGraphGlPair(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitGraphGlPair" ):
                listener.exitGraphGlPair(self)




    def graphGlPair(self):

        localctx = MRSParser.GraphGlPairContext(self, self._ctx, self.state)
        self.enterRule(localctx, 136, self.RULE_graphGlPair)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 645
            self.graphKeyValue()
            self.state = 646
            self.match(MRSParser.COLON_SYMBOL)
            self.state = 647
            self.qualifiedIdentifier()
            self.state = 667
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [66]:
                self.state = 648
                self.match(MRSParser.AT_IN_SYMBOL)
                pass
            elif token in [67]:
                self.state = 649
                self.match(MRSParser.AT_OUT_SYMBOL)
                pass
            elif token in [65]:
                self.state = 650
                self.match(MRSParser.AT_INOUT_SYMBOL)
                pass
            elif token in [68]:
                self.state = 651
                self.match(MRSParser.AT_NOCHECK_SYMBOL)
                pass
            elif token in [70]:
                self.state = 652
                self.match(MRSParser.AT_SORTABLE_SYMBOL)
                pass
            elif token in [71]:
                self.state = 653
                self.match(MRSParser.AT_NOFILTERING_SYMBOL)
                pass
            elif token in [72]:
                self.state = 654
                self.match(MRSParser.AT_ROWOWNERSHIP_SYMBOL)
                pass
            elif token in [73]:
                self.state = 655
                self.match(MRSParser.AT_UNNEST_SYMBOL)
                pass
            elif token in [74]:
                self.state = 656
                self.match(MRSParser.AT_REDUCETO_SYMBOL)
                self.state = 657
                self.match(MRSParser.OPEN_PAR_SYMBOL)
                self.state = 658
                self.graphGlReduceToValue()
                self.state = 659
                self.match(MRSParser.CLOSE_PAR_SYMBOL)
                pass
            elif token in [75]:
                self.state = 661
                self.match(MRSParser.AT_DATATYPE_SYMBOL)
                self.state = 662
                self.match(MRSParser.OPEN_PAR_SYMBOL)
                self.state = 663
                self.graphGlDatatypeValue()
                self.state = 664
                self.match(MRSParser.CLOSE_PAR_SYMBOL)
                pass
            elif token in [69, 76, 77, 78, 79, 80, 81, 82]:
                self.state = 666
                self.graphGlCrudOptions()
                pass
            elif token in [106, 111, 112]:
                pass
            else:
                pass
            self.state = 670
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==111:
                self.state = 669
                self.graphGlObj()


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class GraphKeyValueContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def JSON_STRING(self):
            return self.getToken(MRSParser.JSON_STRING, 0)

        def DOUBLE_QUOTED_TEXT(self):
            return self.getToken(MRSParser.DOUBLE_QUOTED_TEXT, 0)

        def identifier(self):
            return self.getTypedRuleContext(MRSParser.IdentifierContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_graphKeyValue

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterGraphKeyValue" ):
                listener.enterGraphKeyValue(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitGraphKeyValue" ):
                listener.exitGraphKeyValue(self)




    def graphKeyValue(self):

        localctx = MRSParser.GraphKeyValueContext(self, self._ctx, self.state)
        self.enterRule(localctx, 138, self.RULE_graphKeyValue)
        try:
            self.state = 675
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [136]:
                self.enterOuterAlt(localctx, 1)
                self.state = 672
                self.match(MRSParser.JSON_STRING)
                pass
            elif token in [131]:
                self.enterOuterAlt(localctx, 2)
                self.state = 673
                self.match(MRSParser.DOUBLE_QUOTED_TEXT)
                pass
            elif token in [128, 130]:
                self.enterOuterAlt(localctx, 3)
                self.state = 674
                self.identifier()
                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class GraphGlReduceToValueContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def JSON_STRING(self):
            return self.getToken(MRSParser.JSON_STRING, 0)

        def DOUBLE_QUOTED_TEXT(self):
            return self.getToken(MRSParser.DOUBLE_QUOTED_TEXT, 0)

        def identifier(self):
            return self.getTypedRuleContext(MRSParser.IdentifierContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_graphGlReduceToValue

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterGraphGlReduceToValue" ):
                listener.enterGraphGlReduceToValue(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitGraphGlReduceToValue" ):
                listener.exitGraphGlReduceToValue(self)




    def graphGlReduceToValue(self):

        localctx = MRSParser.GraphGlReduceToValueContext(self, self._ctx, self.state)
        self.enterRule(localctx, 140, self.RULE_graphGlReduceToValue)
        try:
            self.state = 680
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [136]:
                self.enterOuterAlt(localctx, 1)
                self.state = 677
                self.match(MRSParser.JSON_STRING)
                pass
            elif token in [131]:
                self.enterOuterAlt(localctx, 2)
                self.state = 678
                self.match(MRSParser.DOUBLE_QUOTED_TEXT)
                pass
            elif token in [128, 130]:
                self.enterOuterAlt(localctx, 3)
                self.state = 679
                self.identifier()
                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class GraphGlDatatypeValueContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def JSON_STRING(self):
            return self.getToken(MRSParser.JSON_STRING, 0)

        def DOUBLE_QUOTED_TEXT(self):
            return self.getToken(MRSParser.DOUBLE_QUOTED_TEXT, 0)

        def identifier(self):
            return self.getTypedRuleContext(MRSParser.IdentifierContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_graphGlDatatypeValue

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterGraphGlDatatypeValue" ):
                listener.enterGraphGlDatatypeValue(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitGraphGlDatatypeValue" ):
                listener.exitGraphGlDatatypeValue(self)




    def graphGlDatatypeValue(self):

        localctx = MRSParser.GraphGlDatatypeValueContext(self, self._ctx, self.state)
        self.enterRule(localctx, 142, self.RULE_graphGlDatatypeValue)
        try:
            self.state = 685
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [136]:
                self.enterOuterAlt(localctx, 1)
                self.state = 682
                self.match(MRSParser.JSON_STRING)
                pass
            elif token in [131]:
                self.enterOuterAlt(localctx, 2)
                self.state = 683
                self.match(MRSParser.DOUBLE_QUOTED_TEXT)
                pass
            elif token in [128, 130]:
                self.enterOuterAlt(localctx, 3)
                self.state = 684
                self.identifier()
                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class GraphGlValueContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def qualifiedIdentifier(self):
            return self.getTypedRuleContext(MRSParser.QualifiedIdentifierContext,0)


        def graphGlObj(self):
            return self.getTypedRuleContext(MRSParser.GraphGlObjContext,0)


        def getRuleIndex(self):
            return MRSParser.RULE_graphGlValue

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterGraphGlValue" ):
                listener.enterGraphGlValue(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitGraphGlValue" ):
                listener.exitGraphGlValue(self)




    def graphGlValue(self):

        localctx = MRSParser.GraphGlValueContext(self, self._ctx, self.state)
        self.enterRule(localctx, 144, self.RULE_graphGlValue)
        try:
            self.state = 689
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [128, 130]:
                self.enterOuterAlt(localctx, 1)
                self.state = 687
                self.qualifiedIdentifier()
                pass
            elif token in [111]:
                self.enterOuterAlt(localctx, 2)
                self.state = 688
                self.graphGlObj()
                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx





