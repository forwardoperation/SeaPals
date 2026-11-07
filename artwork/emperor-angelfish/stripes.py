"""Hand-traced emperor angelfish stripe courses in the 1280 x 853 photo space.

Every path is separate so the SVG remains editable after import into Figma.
Place these on the blue flank, below the pectoral fin and facial overlays.
"""


def build_stripes() -> str:
    # Each course is individually estimated from the supplied reference. The
    # convergence at the dorsal tip and tightening around the caudal peduncle
    # are intentional anatomical features, rather than a repeated wave fill.
    courses = [
        ("01 · Dorsal crown hairline", 2.1, "#D4D89A", .76,
         "M 444 211 C 495 174 549 150 614 133 C 690 113 768 105 849 94 C 935 85 1011 71 1059 79 C 1071 81 1080 85 1085 90"),
        ("02 · Upper crown sweep", 2.6, "#DAD679", .85,
         "M 440 235 C 471 200 518 165 574 150 C 635 135 674 127 724 120 C 826 108 886 104 968 90 C 1030 79 1069 79 1090 95"),
        ("03 · Dorsal olive transition", 3.1, "#DFD56A", .87,
         "M 435 258 C 461 224 482 208 510 184 C 536 159 581 152 625 141 C 664 129 676 124 695 127 C 727 133 789 121 852 117 C 939 110 1022 87 1073 88 C 1084 88 1093 95 1097 101"),
        ("04 · First blue-field band", 4.0, "#E5D454", .95,
         "M 442 278 C 473 253 493 226 523 202 C 531 207 536 203 545 197 C 594 171 640 143 681 140 C 694 139 695 147 707 145 C 759 130 829 133 896 126 C 977 118 1042 95 1085 95 C 1094 96 1098 102 1100 108"),
        ("05 · Shoulder to dorsal sweep", 4.8, "#E8D643", 1,
         "M 453 298 C 489 279 515 250 545 225 C 570 203 600 192 627 176 C 651 163 668 151 691 149 C 703 149 699 158 710 153 C 720 144 744 143 775 143 C 864 145 959 128 1023 110 C 1060 100 1088 98 1102 117"),
        ("06 · Gill shoulder stripe", 5.5, "#E9D737", 1,
         "M 484 310 C 518 301 549 271 576 246 C 602 223 628 222 655 201 C 679 183 691 167 711 164 C 725 163 727 156 733 156 C 797 159 863 153 926 143 C 1000 132 1053 112 1089 112 C 1097 114 1100 121 1101 128"),
        ("07 · Upper flank stripe A", 5.8, "#ECD62E", 1,
         "M 492 335 C 526 325 556 299 587 273 C 624 242 656 233 689 207 C 720 183 740 177 777 174 C 843 168 907 164 970 151 C 1024 140 1071 120 1094 128 C 1099 132 1100 138 1099 145"),
        ("08 · Upper flank stripe B", 6.0, "#EED72B", 1,
         "M 498 360 C 534 349 572 322 605 295 C 639 268 674 255 708 231 C 750 202 771 199 812 194 C 873 189 924 180 976 167 C 1026 154 1072 135 1094 145 C 1098 150 1097 155 1096 162"),
        ("09 · Upper flank stripe C", 6.3, "#EFD628", 1,
         "M 503 384 C 544 373 582 345 616 320 C 653 293 688 274 724 252 C 759 231 782 221 821 216 C 880 209 933 199 981 185 C 1028 171 1070 151 1091 162 C 1094 167 1093 175 1091 183"),
        ("10 · High central sweep", 6.4, "#F0D625", 1,
         "M 508 407 C 551 396 590 371 632 342 C 671 315 710 298 747 276 C 781 253 813 243 851 239 C 900 233 944 222 985 206 C 1030 190 1064 170 1084 182 C 1089 187 1087 196 1085 206"),
        ("11 · Central sweep with natural joint", 6.6, "#F2D622", 1,
         "M 511 430 C 558 420 600 394 644 368 C 674 350 700 335 721 325 C 726 329 720 338 724 341 C 740 338 759 324 779 313 C 823 286 858 271 898 265 C 950 256 987 241 1021 220 C 1048 204 1071 191 1080 207 C 1083 213 1079 223 1077 231"),
        ("12 · Middle flank diagonal", 6.8, "#F4D620", 1,
         "M 514 452 C 563 441 610 419 653 394 C 679 380 701 368 723 357 C 729 355 728 367 739 364 C 789 345 833 309 878 295 C 919 282 953 278 991 260 C 1024 243 1050 219 1068 226 C 1076 231 1072 245 1068 257"),
        ("13 · Pectoral upper crossing", 7.0, "#F4D51F", 1,
         "M 518 473 C 570 461 618 441 668 419 C 721 395 766 378 811 351 C 856 325 892 315 933 307 C 975 298 1006 286 1031 265 C 1050 249 1064 248 1065 262 C 1064 273 1058 285 1053 297"),
        ("14 · Pectoral middle crossing", 7.1, "#F3D41F", 1,
         "M 520 496 C 568 487 618 468 674 446 C 727 425 781 406 829 380 C 880 353 918 345 957 336 C 994 327 1015 314 1034 297 C 1045 286 1054 286 1053 297 C 1050 311 1044 325 1038 334"),
        ("15 · Flank to upper tail root", 7.4, "#F4D31F", 1,
         "M 523 519 C 581 511 629 494 685 474 C 744 453 797 434 848 409 C 900 384 938 374 979 360 C 1009 350 1033 340 1047 339 C 1055 340 1059 346 1058 353"),
        ("16 · Flank to middle tail root", 7.3, "#F2D21E", 1,
         "M 528 541 C 586 536 641 520 697 501 C 755 481 815 461 872 435 C 919 413 963 399 1002 383 C 1033 371 1058 359 1063 354 C 1068 360 1065 370 1060 377"),
        ("17 · Flank to lower tail root", 7.0, "#EFD01F", 1,
         "M 530 562 C 591 562 650 547 712 529 C 773 511 834 491 891 466 C 941 444 985 428 1022 411 C 1046 400 1061 388 1065 378 C 1070 389 1063 403 1056 412"),
        ("18 · Low flank broad sweep", 6.4, "#ECD024", 1,
         "M 536 582 C 594 587 655 574 723 557 C 789 541 850 521 909 496 C 959 475 1000 456 1035 436 C 1047 429 1055 418 1059 409"),
        ("19 · Belly gold transition A", 5.8, "#E5CC2F", .99,
         "M 537 601 C 601 608 665 600 734 584 C 802 569 867 547 924 522 C 967 503 1002 481 1024 456 C 1030 451 1034 449 1038 447"),
        ("20 · Belly gold transition B", 5.0, "#DCC63C", .97,
         "M 541 622 C 605 628 675 622 746 607 C 815 594 877 574 936 545 C 971 528 996 508 1008 486 C 1015 472 1017 460 1022 451"),
        ("21 · Belly gold transition C", 4.0, "#CDBD4B", .91,
         "M 543 640 C 611 647 684 642 758 628 C 828 615 890 594 942 569 C 976 553 1000 532 1010 509 C 1021 486 1024 465 1029 453"),
        ("22 · Low belly hairline", 3.0, "#B9AF61", .78,
         "M 548 657 C 616 665 691 658 766 648 C 838 638 899 616 951 590 C 983 574 1005 552 1018 529 C 1031 504 1036 479 1036 461"),
        ("23 · Lower flank muted filament", 2.0, "#A4A071", .63,
         "M 552 672 C 625 677 700 676 780 666 C 850 657 912 636 961 609 C 995 590 1015 569 1028 544 C 1040 520 1045 494 1043 475"),
        ("24 · Ventral muted filament", 1.5, "#90917D", .48,
         "M 563 686 C 637 687 711 689 789 681 C 861 673 923 652 970 627 C 1000 611 1023 588 1038 560 C 1048 539 1053 515 1050 495"),
    ]
    out = ['<g id="04_Individual_Yellow_Stripe_Courses" fill="none" stroke-linecap="round" stroke-linejoin="round">']
    for name, width, color, opacity, path in courses:
        safe_name = name.replace(' · ', '_').replace(' ', '_')
        out.append(f'<path id="Stripe_{safe_name}" d="{path}" stroke="{color}" stroke-width="{width}" opacity="{opacity}"/>')
    out.append('</g>')
    # These are separate continuations in the dark anal membrane, preserving
    # the clear blue filaments without filling the entire fin with yellow.
    anal = [
        ("01_inner_anal_ray", "M 932 550 C 968 528 992 500 1007 455", 2.5, .96),
        ("02_inner_anal_ray", "M 937 579 C 974 557 1000 529 1016 496 C 1023 482 1029 465 1029 454", 2.7, 1),
        ("03_mid_anal_ray", "M 920 613 C 972 588 1004 558 1026 525 C 1038 505 1044 485 1040 466", 2.5, .92),
        ("04_mid_anal_ray", "M 899 644 C 955 625 1000 594 1029 559 C 1045 537 1054 513 1048 490", 2.6, .94),
        ("05_outer_anal_ray", "M 858 671 C 925 659 982 632 1021 596 C 1044 574 1058 548 1057 525", 2.6, .91),
        ("06_outer_anal_ray", "M 810 686 C 886 684 949 665 1000 630 C 1030 610 1053 580 1060 555", 2.7, .91),
        ("07_anal_edge_parallel", "M 777 697 C 852 707 927 693 985 663 C 1022 643 1050 614 1061 584", 2.7, .94),
    ]
    out.append('<g id="05_Individual_Blue_Anal_Filaments" fill="none" stroke="#173DEE" stroke-linecap="round">')
    for name, path, width, opacity in anal:
        out.append(f'<path id="Anal_{name}" d="{path}" stroke-width="{width}" opacity="{opacity}"/>')
    out.append('</g>')
    return '\n'.join(out)


if __name__ == '__main__':
    print(build_stripes())
