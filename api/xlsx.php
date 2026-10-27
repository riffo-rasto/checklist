<?php
// Penulis XLSX sederhana: styling, sel gabungan, dan gambar. Tanpa library (butuh ekstensi php-zip)
function xl_col(int $i): string { $s = ''; for (++$i; $i > 0; $i = intdiv($i - 1, 26)) $s = chr(65 + ($i - 1) % 26) . $s; return $s; }
function xl_x(string $v): string { return htmlspecialchars(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $v), ENT_XML1); }

// Thumbnail evidence untuk Excel: dikecilkan maks. 320 px (butuh php-gd; tanpa GD dipakai file asli)
function evidence_thumb(string $path, string $mime): ?array {
    $raw = @file_get_contents($path);
    if ($raw === false) return null;
    if (!function_exists('imagecreatefromstring')) return $mime === 'image/webp' ? null : [$raw, $mime === 'image/png' ? 'png' : 'jpg'];
    $im = @imagecreatefromstring($raw);
    if (!$im) return null;
    [$w, $h] = [imagesx($im), imagesy($im)];
    $k = min(1, 320 / max($w, $h));
    $t = imagecreatetruecolor(max(1, (int)round($w * $k)), max(1, (int)round($h * $k)));
    imagecopyresampled($t, $im, 0, 0, 0, 0, imagesx($t), imagesy($t), $w, $h);
    ob_start();
    imagejpeg($t, null, 78);
    return [ob_get_clean(), 'jpg'];
}

/* $sheets = [['name','title','sub','head'=>[],'widths'=>[],'rows'=>[...],'status'=>kolom|[kolom],'center'=>[kolom],'fc'=>kolom beku,'nofilter'=>bool], ...]
   Satu baris bisa berupa: [sel,...] | ['cells'=>[..],'ht'=>tinggi pt,'img'=>[[kolom,data,ext,wpx,hpx],..]] | ['banner'=>teks] | ['spacer'=>1] */
function xlsx_build(array $sheets): string {
    $H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    $NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
    $RT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    $PK = 'http://schemas.openxmlformats.org/package/2006/relationships';
    $sty = ['OK' => 6, 'Warning' => 7, 'Down' => 8, 'N/A' => 9, 'Selesai' => 6, 'Proses' => 7, 'Belum' => 8];   // indeks style di styles.xml di bawah
    $tmp = tempnam(sys_get_temp_dir(), 'xl');
    $z = new ZipArchive();
    $z->open($tmp, ZipArchive::OVERWRITE);
    $ct = $wb = $rel = '';
    $media = $dn = 0;
    foreach ($sheets as $n => $s) {
        $k = $n + 1;
        $nc = count($s['head']);
        $last = xl_col($nc - 1);
        $fc = $s['fc'] ?? 0;
        $pane = $fc ? "<pane xSplit=\"$fc\" ySplit=\"4\" topLeftCell=\"" . xl_col($fc) . "5\" activePane=\"bottomRight\" state=\"frozen\"/>"
                    : '<pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/>';
        $x = '<row r="1" ht="24" customHeight="1"><c r="A1" t="inlineStr" s="1"><is><t>' . xl_x($s['title']) . '</t></is></c></row>'
           . '<row r="2"><c r="A2" t="inlineStr" s="2"><is><t>' . xl_x($s['sub']) . '</t></is></c></row><row r="4" ht="26" customHeight="1">';
        foreach ($s['head'] as $c => $h) $x .= '<c r="' . xl_col($c) . '4" t="inlineStr" s="3"><is><t>' . xl_x($h) . '</t></is></c>';
        $x .= '</row>';
        $merge = ["A1:{$last}1", "A2:{$last}2"];
        $imgs = [];
        foreach ($s['rows'] as $r => $row) {
            $rn = $r + 5;
            if (isset($row['spacer'])) { $x .= "<row r=\"$rn\" ht=\"8\" customHeight=\"1\"/>"; continue; }
            if (isset($row['banner'])) {   // judul per tanggal + shift (sel digabung)
                $x .= "<row r=\"$rn\" ht=\"22\" customHeight=\"1\">";
                for ($c = 0; $c < $nc; $c++)
                    $x .= '<c r="' . xl_col($c) . $rn . '" s="10"' . ($c ? '/>' : ' t="inlineStr"><is><t>' . xl_x($row['banner']) . '</t></is></c>');
                $x .= '</row>';
                $merge[] = "A$rn:$last$rn";
                continue;
            }
            $cells = $row['cells'] ?? $row;
            $x .= "<row r=\"$rn\"" . (isset($row['ht']) ? " ht=\"{$row['ht']}\" customHeight=\"1\"" : '') . '>';
            foreach ($cells as $c => $v) {
                $st = in_array($c, (array)($s['status'] ?? []), true) ? ($sty[$v] ?? 5) : (in_array($c, $s['center'], true) ? 5 : 4);
                $ref = xl_col($c) . $rn;
                $x .= is_int($v) ? "<c r=\"$ref\" s=\"$st\"><v>$v</v></c>"
                                 : "<c r=\"$ref\" t=\"inlineStr\" s=\"$st\"><is><t>" . xl_x((string)$v) . '</t></is></c>';
            }
            $x .= '</row>';
            foreach ($row['img'] ?? [] as $im) $imgs[] = [$rn - 1, ...$im];   // [baris, kolom, data, ext, w, h]
        }
        $cols = '';
        foreach ($s['widths'] as $c => $w) $cols .= '<col min="' . ($c + 1) . '" max="' . ($c + 1) . "\" width=\"$w\" customWidth=\"1\"/>";
        $filter = empty($s['nofilter']) ? '<autoFilter ref="A4:' . $last . (4 + count($s['rows'])) . '"/>' : '';
        $mc = '<mergeCells count="' . count($merge) . '">' . implode('', array_map(fn($m) => "<mergeCell ref=\"$m\"/>", $merge)) . '</mergeCells>';

        $draw = '';
        if ($imgs) {   // gambar: drawing + file media + relasi
            $dn++;
            $dx = $H . '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="' . $RT . '">';
            $dr = '';
            foreach ($imgs as $i => [$row, $col, $data, $ext, $w, $h]) {
                $id = $i + 1; $m = ++$media;
                $z->addFromString("xl/media/image$m.$ext", $data);
                $cx = $w * 9525; $cy = $h * 9525;   // piksel -> EMU
                $dx .= "<xdr:oneCellAnchor><xdr:from><xdr:col>$col</xdr:col><xdr:colOff>47625</xdr:colOff><xdr:row>$row</xdr:row><xdr:rowOff>47625</xdr:rowOff></xdr:from><xdr:ext cx=\"$cx\" cy=\"$cy\"/>"
                     . '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="' . ($id + 1) . "\" name=\"Foto $id\"/><xdr:cNvPicPr><a:picLocks noChangeAspect=\"1\"/></xdr:cNvPicPr></xdr:nvPicPr>"
                     . "<xdr:blipFill><a:blip r:embed=\"rId$id\"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>"
                     . "<xdr:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"$cx\" cy=\"$cy\"/></a:xfrm><a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>";
                $dr .= "<Relationship Id=\"rId$id\" Type=\"$RT/image\" Target=\"../media/image$m.$ext\"/>";
            }
            $z->addFromString("xl/drawings/drawing$dn.xml", $dx . '</xdr:wsDr>');
            $z->addFromString("xl/drawings/_rels/drawing$dn.xml.rels", $H . "<Relationships xmlns=\"$PK\">$dr</Relationships>");
            $z->addFromString("xl/worksheets/_rels/sheet$k.xml.rels", $H . "<Relationships xmlns=\"$PK\"><Relationship Id=\"rId1\" Type=\"$RT/drawing\" Target=\"../drawings/drawing$dn.xml\"/></Relationships>");
            $ct .= "<Override PartName=\"/xl/drawings/drawing$dn.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.drawing+xml\"/>";
            $draw = '<drawing r:id="rId1"/>';
        }
        $z->addFromString("xl/worksheets/sheet$k.xml", $H . "<worksheet $NS xmlns:r=\"$RT\"><sheetPr><pageSetUpPr fitToPage=\"1\"/></sheetPr>"
            . '<sheetViews><sheetView showGridLines="0" workbookViewId="0">' . $pane . '</sheetView></sheetViews>'
            . "<cols>$cols</cols><sheetData>$x</sheetData>$filter$mc"
            . '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>' . $draw . '</worksheet>');
        $ct .= "<Override PartName=\"/xl/worksheets/sheet$k.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>";
        $wb .= '<sheet name="' . xl_x($s['name']) . "\" sheetId=\"$k\" r:id=\"rId$k\"/>";
        $rel .= "<Relationship Id=\"rId$k\" Type=\"$RT/worksheet\" Target=\"worksheets/sheet$k.xml\"/>";
    }
    $ks = count($sheets) + 1;
    $rel .= "<Relationship Id=\"rId$ks\" Type=\"$RT/styles\" Target=\"styles.xml\"/>";

    // ---- styles.xml: font, warna isi, border, lalu gabungannya (cellXfs)
    $font = fn($extra, $rgb = null) => '<font>' . $extra . ($rgb ? "<color rgb=\"FF$rgb\"/>" : '') . '<name val="Arial"/></font>';
    $fill = fn($rgb) => "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF$rgb\"/><bgColor indexed=\"64\"/></patternFill></fill>";
    $b1 = '<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>';
    $xf = fn($fo, $fi, $bo, $al = '') => "<xf numFmtId=\"0\" fontId=\"$fo\" fillId=\"$fi\" borderId=\"$bo\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\"" . ($al ? " applyAlignment=\"1\">$al</xf>" : '/>');
    $top = '<alignment vertical="top" wrapText="1"/>';
    $mid = '<alignment horizontal="center" vertical="top" wrapText="1"/>';
    $styles = $H . "<styleSheet $NS><fonts count=\"9\">"
        . $font('<sz val="10"/>') . $font('<b/><sz val="14"/>', '1F3864') . $font('<i/><sz val="10"/>', '595959') . $font('<b/><sz val="10"/>', 'FFFFFF')
        . $font('<b/><sz val="10"/>', '006100') . $font('<b/><sz val="10"/>', '9C5700') . $font('<b/><sz val="10"/>', '9C0006') . $font('<b/><sz val="10"/>', '595959')
        . $font('<b/><sz val="11"/>', '16232E')
        . '</fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
        . $fill('1F3864') . $fill('C6EFCE') . $fill('FFEB9C') . $fill('FFC7CE') . $fill('E7E6E6') . $fill('DCE6F1')
        . '</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' . $b1 . '</borders>'
        . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="11">'
        . $xf(0, 0, 0) . $xf(1, 0, 0, '<alignment vertical="center"/>') . $xf(2, 0, 0)
        . $xf(3, 2, 1, '<alignment horizontal="center" vertical="center" wrapText="1"/>')
        . $xf(0, 0, 1, $top) . $xf(0, 0, 1, $mid)
        . $xf(4, 3, 1, $mid) . $xf(5, 4, 1, $mid) . $xf(6, 5, 1, $mid) . $xf(7, 6, 1, $mid)
        . $xf(8, 7, 1, '<alignment vertical="center"/>')
        . '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

    $z->addFromString('xl/styles.xml', $styles);
    $z->addFromString('[Content_Types].xml', $H . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' . $ct . '</Types>');
    $z->addFromString('_rels/.rels', $H . "<Relationships xmlns=\"$PK\"><Relationship Id=\"rId1\" Type=\"$RT/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
    $z->addFromString('xl/workbook.xml', $H . "<workbook $NS xmlns:r=\"$RT\"><sheets>$wb</sheets></workbook>");
    $z->addFromString('xl/_rels/workbook.xml.rels', $H . "<Relationships xmlns=\"$PK\">$rel</Relationships>");
    $z->close();
    return $tmp;
}
