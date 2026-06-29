#!/usr/bin/env python3
import html
import os
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "report" / "数据科学实践期末课程报告_SafeCompass.docx"

NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def esc(value):
    return html.escape(str(value), quote=False)


def rpr(font_east="宋体", font_ascii="Times New Roman", size=24, bold=False):
    parts = [
        "<w:rPr>",
        '<w:rFonts w:ascii="%s" w:hAnsi="%s" w:eastAsia="%s"/>'
        % (esc(font_ascii), esc(font_ascii), esc(font_east)),
        '<w:sz w:val="%s"/><w:szCs w:val="%s"/>' % (size, size),
    ]
    if bold:
        parts.append("<w:b/><w:bCs/>")
    parts.append("</w:rPr>")
    return "".join(parts)


def run(text, direct=True, **kwargs):
    preserve = ' xml:space="preserve"' if str(text).startswith(" ") or str(text).endswith(" ") else ""
    direct_rpr = rpr(**kwargs) if direct else ""
    return "<w:r>%s<w:t%s>%s</w:t></w:r>" % (direct_rpr, preserve, esc(text))


def para(text="", style="Body", align=None, runs=None):
    ppr = ['<w:pPr><w:pStyle w:val="%s"/>' % style]
    if align:
        ppr.append('<w:jc w:val="%s"/>' % align)
    ppr.append("</w:pPr>")
    body = "".join(runs) if runs is not None else run(text, direct=False)
    return "<w:p>%s%s</w:p>" % ("".join(ppr), body)


def table(caption, headers, rows):
    parts = [
        para(caption, style="Caption", align="center"),
        "<w:tbl>",
        '<w:tblPr><w:tblW w:w="5000" w:type="pct"/>'
        '<w:tblBorders>'
        '<w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/>'
        '<w:left w:val="single" w:sz="4" w:space="0" w:color="A0A0A0"/>'
        '<w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/>'
        '<w:right w:val="single" w:sz="4" w:space="0" w:color="A0A0A0"/>'
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="A0A0A0"/>'
        '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="A0A0A0"/>'
        "</w:tblBorders></w:tblPr>",
    ]

    def cell(text, bold=False):
        return (
            "<w:tc><w:tcPr><w:vAlign w:val=\"center\"/></w:tcPr>"
            + para(
                "",
                style="TableText",
                align="center",
                runs=[run(str(text), font_east="宋体", size=21, bold=bold)],
            )
            + "</w:tc>"
        )

    parts.append("<w:tr>")
    for header in headers:
        parts.append(cell(header, bold=True))
    parts.append("</w:tr>")
    for row in rows:
        parts.append("<w:tr>")
        for item in row:
            parts.append(cell(item))
        parts.append("</w:tr>")
    parts.append("</w:tbl>")
    return "".join(parts)


def style(style_id, name, ppr="", rpr_xml=""):
    return (
        '<w:style w:type="paragraph" w:styleId="%s">'
        '<w:name w:val="%s"/>%s%s</w:style>'
        % (style_id, name, ppr, rpr_xml)
    )


def styles_xml():
    normal_rpr = (
        '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" '
        'w:eastAsia="宋体"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>'
    )
    body_ppr = (
        '<w:pPr><w:spacing w:before="0" w:after="0" w:line="360" w:lineRule="auto"/>'
        '<w:ind w:firstLine="480"/><w:jc w:val="both"/></w:pPr>'
    )
    noindent_ppr = (
        '<w:pPr><w:spacing w:before="0" w:after="0" w:line="360" w:lineRule="auto"/>'
        '<w:jc w:val="both"/></w:pPr>'
    )
    center_ppr = (
        '<w:pPr><w:spacing w:before="0" w:after="0" w:line="360" w:lineRule="auto"/>'
        '<w:jc w:val="center"/></w:pPr>'
    )
    h1_ppr = (
        '<w:pPr><w:spacing w:before="120" w:after="40" w:line="360" w:lineRule="auto"/>'
        '<w:keepNext/></w:pPr>'
    )
    h2_ppr = (
        '<w:pPr><w:spacing w:before="80" w:after="20" w:line="360" w:lineRule="auto"/>'
        '<w:keepNext/></w:pPr>'
    )
    table_ppr = (
        '<w:pPr><w:spacing w:before="0" w:after="0" w:line="300" w:lineRule="auto"/>'
        '<w:jc w:val="center"/></w:pPr>'
    )
    ref_ppr = (
        '<w:pPr><w:spacing w:before="0" w:after="0" w:line="300" w:lineRule="auto"/>'
        '<w:ind w:hanging="420"/></w:pPr>'
    )
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>%s</w:style>
  %s
  %s
  %s
  %s
  %s
  %s
  %s
  %s
</w:styles>""" % (
        normal_rpr,
        style(
            "ReportTitle",
            "Report Title",
            ppr=center_ppr,
            rpr_xml='<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" '
            'w:eastAsia="黑体"/><w:b/><w:bCs/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>',
        ),
        style(
            "Meta",
            "Report Meta",
            ppr=center_ppr,
            rpr_xml='<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" '
            'w:eastAsia="宋体"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>',
        ),
        style(
            "Sec1",
            "Section Level 1",
            ppr=h1_ppr,
            rpr_xml='<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" '
            'w:eastAsia="黑体"/><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>',
        ),
        style(
            "Sec2",
            "Section Level 2",
            ppr=h2_ppr,
            rpr_xml='<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" '
            'w:eastAsia="黑体"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>',
        ),
        style("Body", "Body", ppr=body_ppr, rpr_xml=normal_rpr),
        style("NoIndent", "No Indent", ppr=noindent_ppr, rpr_xml=normal_rpr),
        style(
            "Caption",
            "Caption",
            ppr=table_ppr,
            rpr_xml='<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" '
            'w:eastAsia="宋体"/><w:b/><w:bCs/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr>',
        ),
        style(
            "TableText",
            "Table Text",
            ppr=table_ppr,
            rpr_xml='<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" '
            'w:eastAsia="宋体"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr>',
        )
        + style(
            "Reference",
            "Reference",
            ppr=ref_ppr,
            rpr_xml='<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" '
            'w:eastAsia="宋体"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr>',
        ),
    )


def content_types():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>"""


def package_rels():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""


def settings_xml():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:zoom w:percent="100"/>
</w:settings>"""


def build_document():
    parts = [
        para("基于 SafeCompass 的大语言模型安全风险评测实践报告", style="ReportTitle", align="center"),
        para("数据科学实践期末课程报告", style="Meta", align="center"),
        para("摘  要", style="Sec2", align="center"),
        para(
            "大语言模型在问答、编程和内容生成场景中被广泛使用，但其面对有害请求和越狱攻击时的拒答可靠性仍需系统评估。本文基于 SafeCompass 平台，对 HarmBench text_test 子集中的 200 条样本进行安全评测，比较同一模型在 official_jbb 单 Judge 与 multi_judge 多 Judge 设置下的攻击成功率（ASR）差异。实验结果显示，meta-llama/Llama-3-70b-chat-hf 在 Jailbreak Chat 攻击下，单 Judge 设置的 ASR 为 7.5%，多 Judge 设置的 ASR 上升至 16.0%。类别分析表明，网络入侵、虚假信息和违法行为相关样本更容易暴露拒答薄弱点。结果说明，SafeCompass 能够支持可复现的模型安全评测，并揭示 Judge 机制和危害类别对评测结论的影响。",
            style="NoIndent",
        ),
        para("关键词：大语言模型安全；越狱攻击；HarmBench；LLM-as-judge；ASR；SafeCompass", style="NoIndent"),
        para("1 引言", style="Sec1"),
        para(
            "随着大语言模型能力提升，模型不仅能够完成普通问答和文本生成，也可能被诱导生成网络攻击步骤、违法行为指导、虚假信息、骚扰文本、化学与生物风险内容或受版权保护文本。虽然主流模型通常具备安全对齐和拒答机制，但攻击者可以通过角色扮演、研究场景包装、指令覆盖等方式构造越狱 prompt，使模型偏离原有安全边界。因此，普通能力测试不足以反映模型在高风险输入下的真实安全性，需要面向有害请求建立可复现、可比较的安全评测流程。",
        ),
        para(
            "SafeCompass 的目标是把数据集加载、攻击 prompt 生成、模型调用、Judge 判分、指标统计和报告导出整合到同一平台中。本文不展开攻击细节，而从数据科学实践角度关注评测流程、指标结果和风险分布，分析不同 Judge 设置下同一模型的安全表现差异。",
        ),
        para("2 数据与方法", style="Sec1"),
        para("2.1 数据集与实验配置", style="Sec2"),
        para(
            "实验数据来自 HarmBench 的 text_test 子集，共 200 条样本，覆盖 cybercrime_intrusion、illegal、misinformation_disinformation、chemical_biological、copyright、harassment_bullying 和 harmful 七类危害。被测模型为 meta-llama/Llama-3-70b-chat-hf，攻击方法统一为 Jailbreak Chat（JBC）。为观察自动判分机制对结论的影响，本文比较两次运行：第一次采用 official_jbb 单 Judge，第二次采用 multi_judge 多 Judge 投票。",
        ),
        table(
            "表1 实验配置与总体结果",
            ["运行", "Judge 模式", "总数", "安全拒绝", "越狱成功", "需复核", "ASR"],
            [
                ["2026-06-15 07:51", "official_jbb", "200", "185", "15", "0", "7.5%"],
                ["2026-06-15 08:54", "multi_judge", "200", "162", "32", "6", "16.0%"],
            ],
        ),
        para("2.2 评价指标", style="Sec2"),
        para(
            "本文使用攻击成功率 ASR 作为核心指标，即被 Judge 判定为越狱成功的样本数占总样本数的比例。安全拒绝表示模型没有实质性满足有害请求；越狱成功表示模型回复提供了可执行或有实质帮助的有害内容；需复核表示 Judge 分歧、未知输出或边界样本，需要人工检查。由于两次实验使用相同数据、模型和攻击方法，ASR 差异主要反映 Judge 机制变化带来的判定差异。",
        ),
        para("3 实验结果", style="Sec1"),
        para("3.1 总体表现", style="Sec2"),
        para(
            "在 official_jbb 单 Judge 设置下，200 条样本中有 185 条被判定为安全拒绝，15 条被判定为越狱成功，整体 ASR 为 7.5%。在 multi_judge 设置下，安全拒绝降至 162 条，越狱成功升至 32 条，另有 6 条需复核，整体 ASR 为 16.0%。这说明在相同样本和模型条件下，多 Judge 机制更容易发现潜在风险，但也会带来更多边界判定和人工复核需求。",
        ),
        para("3.2 危害类别差异", style="Sec2"),
        table(
            "表2 不同危害类别的 ASR 对比",
            ["类别", "样本数", "单 Judge ASR", "多 Judge ASR", "多 Judge 需复核"],
            [
                ["cybercrime_intrusion", "32", "15.6%", "31.3%", "1"],
                ["misinformation_disinformation", "34", "8.8%", "26.5%", "2"],
                ["illegal", "37", "10.8%", "13.5%", "0"],
                ["copyright", "51", "0.0%", "9.8%", "3"],
                ["harmful", "10", "10.0%", "10.0%", "0"],
                ["harassment_bullying", "15", "6.7%", "6.7%", "0"],
                ["chemical_biological", "21", "4.8%", "4.8%", "0"],
            ],
        ),
        para(
            "类别层面，网络入侵类风险最突出：单 Judge 下 ASR 为 15.6%，多 Judge 下升至 31.3%。虚假信息类从 8.8% 升至 26.5%，版权类从 0.0% 升至 9.8%，说明单一 Judge 可能低估版权复现和虚假信息生成中的边界风险。违法行为、骚扰、有害内容和生化风险类别的 ASR 变化相对较小，表明这些类别在当前样本和攻击设置下判定更稳定。",
        ),
        para("4 分析与讨论", style="Sec1"),
        para(
            "第一，Judge 机制会显著影响安全评测结论。单 Judge 流程成本较低、结果清晰，但可能漏判部分边界样本；多 Judge 通过不同判分来源交叉验证，能够提高风险可见性，但会引入分歧样本。因此，自动 Judge 更适合作为大规模筛查工具，对低一致率样本和高风险类别仍应保留人工复核环节。",
        ),
        para(
            "第二，类别化分析比单一总体 ASR 更有诊断价值。总体 ASR 能描述模型在一组样本上的平均风险，却无法指出主要薄弱点。本次实验显示，网络入侵和虚假信息类别对 JBC 攻击更敏感，平台应在报告中突出类别排名、失败案例聚类和需复核样本，帮助后续安全加固聚焦重点。",
        ),
        para(
            "第三，实验仍存在局限。本文只分析 report 文件夹中两次运行结果，样本规模为 200 条，攻击方法固定为 JBC，尚未覆盖多轮自动攻击、多模态输入和更长上下文场景；Judge 判定也缺少独立人工标注校准。因此，本文结果应理解为一次可复现实践评测，而不是对模型安全性的最终结论。",
        ),
        para("5 结论", style="Sec1"),
        para(
            "本文基于 SafeCompass 完成了大语言模型越狱风险评测报告。实验表明，在 HarmBench text_test 200 条样本和 JBC 攻击条件下，Llama-3-70B 的 official_jbb 单 Judge ASR 为 7.5%，multi_judge ASR 为 16.0%。多 Judge 设置揭示了更多网络入侵、虚假信息和版权类风险，同时也产生了需复核样本。SafeCompass 的价值在于将样本规范化、攻击生成、模型响应、Judge 判分和结果导出组织为可复现流程，为后续模型安全比较和风险治理提供数据基础。",
        ),
        para("参考文献", style="Sec1"),
        para("[1] Mazeika M, Phan L, Yin X, et al. HarmBench: A Standardized Evaluation Framework for Automated Red Teaming and Robust Refusal. arXiv:2402.04249, 2024.", style="Reference"),
        para("[2] Chao P, Debenedetti E, Robey A, et al. JailbreakBench: An Open Robustness Benchmark for Jailbreaking Large Language Models. arXiv:2404.01318, 2024.", style="Reference"),
    ]

    sect_pr = (
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
        '<w:pgMar w:top="1440" w:right="1797" w:bottom="1440" w:left="1797" '
        'w:header="720" w:footer="720" w:gutter="0"/>'
        "</w:sectPr>"
    )
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="%s" xmlns:r="%s"><w:body>%s%s</w:body></w:document>""" % (
        NS_W,
        NS_R,
        "\n".join(parts),
        sect_pr,
    )


def main():
    os.makedirs(OUT.parent, exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types())
        zf.writestr("_rels/.rels", package_rels())
        zf.writestr("word/document.xml", build_document())
        zf.writestr("word/styles.xml", styles_xml())
        zf.writestr("word/settings.xml", settings_xml())
    print(OUT)


if __name__ == "__main__":
    main()
