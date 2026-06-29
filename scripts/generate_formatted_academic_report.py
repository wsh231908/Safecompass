#!/usr/bin/env python3
import html
import os
import zipfile


OUT = "/home/u2023202105/Safecompass/report/safecompass-final-academic-report-formatted.docx"

NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def esc(text):
    return html.escape(str(text), quote=False)


def rpr(font_east="宋体", font_ascii="Times New Roman", size=24, bold=False, italic=False,
        superscript=False):
    parts = [
        '<w:rPr>',
        '<w:rFonts w:ascii="%s" w:hAnsi="%s" w:eastAsia="%s"/>' % (
            esc(font_ascii), esc(font_ascii), esc(font_east)
        ),
        '<w:sz w:val="%s"/><w:szCs w:val="%s"/>' % (size, size),
    ]
    if bold:
        parts.append("<w:b/><w:bCs/>")
    if italic:
        parts.append("<w:i/><w:iCs/>")
    if superscript:
        parts.append('<w:vertAlign w:val="superscript"/>')
    parts.append("</w:rPr>")
    return "".join(parts)


def run(text, **kwargs):
    preserve = ' xml:space="preserve"' if text.startswith(" ") or text.endswith(" ") else ""
    return "<w:r>%s<w:t%s>%s</w:t></w:r>" % (rpr(**kwargs), preserve, esc(text))


def para(text="", style="BodyText", align=None, runs=None, page_break_before=False):
    ppr = ['<w:pPr><w:pStyle w:val="%s"/>' % style]
    if align:
        ppr.append('<w:jc w:val="%s"/>' % align)
    if page_break_before:
        ppr.append("<w:pageBreakBefore/>")
    ppr.append("</w:pPr>")
    body = "".join(runs) if runs is not None else run(text)
    return "<w:p>%s%s</w:p>" % ("".join(ppr), body)


def page_break():
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def section_break_to_main():
    return (
        '<w:p><w:pPr><w:sectPr>'
        '<w:type w:val="nextPage"/>'
        '<w:pgSz w:w="11906" w:h="16838"/>'
        '<w:pgMar w:top="1440" w:right="1797" w:bottom="1440" w:left="1797" '
        'w:header="720" w:footer="720" w:gutter="0"/>'
        '<w:footerReference w:type="default" r:id="rIdFooterRoman"/>'
        '<w:pgNumType w:fmt="lowerRoman" w:start="1"/>'
        '</w:sectPr></w:pPr></w:p>'
    )


def final_section_props():
    return (
        '<w:sectPr>'
        '<w:pgSz w:w="11906" w:h="16838"/>'
        '<w:pgMar w:top="1440" w:right="1797" w:bottom="1440" w:left="1797" '
        'w:header="720" w:footer="720" w:gutter="0"/>'
        '<w:footerReference w:type="default" r:id="rIdFooterArabic"/>'
        '<w:pgNumType w:fmt="decimal" w:start="1"/>'
        '</w:sectPr>'
    )


def table(caption, headers, rows, widths=None):
    parts = [
        para(caption, style="TableCaption", align="center"),
        '<w:tbl>',
        '<w:tblPr><w:tblW w:w="5000" w:type="pct"/>'
        '<w:tblBorders>'
        '<w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/>'
        '<w:left w:val="nil"/>'
        '<w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/>'
        '<w:right w:val="nil"/>'
        '<w:insideH w:val="nil"/>'
        '<w:insideV w:val="nil"/>'
        '</w:tblBorders></w:tblPr>',
    ]
    if widths:
        parts.append("<w:tblGrid>")
        for w in widths:
            parts.append('<w:gridCol w:w="%s"/>' % w)
        parts.append("</w:tblGrid>")

    def cell(text, bold=False, header=False):
        tcpr = ['<w:tcPr><w:vAlign w:val="center"/>']
        if header:
            tcpr.append(
                '<w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" '
                'w:color="000000"/></w:tcBorders>'
            )
        tcpr.append("</w:tcPr>")
        return (
            "<w:tc>%s%s</w:tc>" %
            ("".join(tcpr), para(str(text), style="TableText", align="center",
                                runs=[run(str(text), font_east="宋体", size=24, bold=bold)]))
        )

    parts.append("<w:tr>")
    for h in headers:
        parts.append(cell(h, bold=True, header=True))
    parts.append("</w:tr>")
    for row in rows:
        parts.append("<w:tr>")
        for item in row:
            parts.append(cell(item))
        parts.append("</w:tr>")
    parts.append("</w:tbl>")
    return "".join(parts)


def ref_run(num):
    return run("[%s]" % num, font_east="宋体", font_ascii="Times New Roman", size=24, superscript=True)


def content_types():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>"""


def package_rels():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""


def document_rels():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdFooterRoman" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
  <Relationship Id="rIdFooterArabic" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>
</Relationships>"""


def settings_xml():
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:updateFields w:val="true"/>
</w:settings>"""


def footer_xml(sample_text):
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="15"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="15"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="15"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="15"/></w:rPr><w:t>%s</w:t></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="15"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>
  </w:p>
</w:ftr>""" % esc(sample_text)


def style(style_id, name, based_on="Normal", qformat=False, ppr="", rpr_xml=""):
    q = "<w:qFormat/>" if qformat else ""
    return (
        '<w:style w:type="paragraph" w:styleId="%s">'
        '<w:name w:val="%s"/><w:basedOn w:val="%s"/>%s%s%s</w:style>'
        % (style_id, name, based_on, q, ppr, rpr_xml)
    )


def styles_xml():
    normal_rpr = (
        '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" '
        'w:eastAsia="宋体"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>'
    )
    body_ppr = (
        '<w:pPr><w:spacing w:line="360" w:lineRule="auto"/>'
        '<w:ind w:firstLine="480"/><w:jc w:val="both"/></w:pPr>'
    )
    noindent_ppr = '<w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr>'
    center_ppr = '<w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>'
    h1_ppr = '<w:pPr><w:spacing w:before="160" w:after="80" w:line="360" w:lineRule="auto"/><w:keepNext/></w:pPr>'
    h2_ppr = '<w:pPr><w:spacing w:before="120" w:after="60" w:line="360" w:lineRule="auto"/><w:keepNext/></w:pPr>'
    table_ppr = '<w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>'
    ref_ppr = '<w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:ind w:hanging="420"/></w:pPr>'
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
  %s
  %s
</w:styles>""" % (
        normal_rpr,
        style("TitleCN", "Chinese Title", ppr=center_ppr,
              rpr_xml='<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="黑体"/><w:b/><w:sz w:val="32"/></w:rPr>'),
        style("TitleEN", "English Title", ppr=center_ppr,
              rpr_xml='<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:b/><w:sz w:val="32"/></w:rPr>'),
        style("TOCTitle", "TOC Title", ppr=center_ppr,
              rpr_xml='<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="黑体"/><w:b/><w:sz w:val="32"/></w:rPr>'),
        style("Heading1Custom", "Heading 1 Custom", qformat=True, ppr=h1_ppr,
              rpr_xml='<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="黑体"/><w:b/><w:sz w:val="28"/></w:rPr>'),
        style("Heading2Custom", "Heading 2 Custom", qformat=True, ppr=h2_ppr,
              rpr_xml='<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="黑体"/><w:b/><w:sz w:val="24"/></w:rPr>'),
        style("Heading3Custom", "Heading 3 Custom", qformat=True, ppr=h2_ppr,
              rpr_xml='<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:b/><w:sz w:val="24"/></w:rPr>'),
        style("BodyText", "Body Text Custom", ppr=body_ppr, rpr_xml=normal_rpr),
        style("NoIndent", "No Indent Custom", ppr=noindent_ppr, rpr_xml=normal_rpr),
        style("TableCaption", "Table Caption", ppr=table_ppr,
              rpr_xml='<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:b/><w:sz w:val="24"/></w:rPr>'),
        style("TableText", "Table Text", ppr=table_ppr, rpr_xml=normal_rpr),
    ) + style("ReferenceText", "Reference Text", ppr=ref_ppr,
              rpr_xml='<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="21"/></w:rPr>').replace("</w:styles>", "")


def build_doc():
    parts = []
    # Front matter: Chinese title and abstract.
    parts.append(para("SafeCompass：面向大语言模型越狱风险的可复现安全评测与可视化平台", style="TitleCN", align="center"))
    parts.append(para("课程：数据科学实践", style="NoIndent", align="center"))
    parts.append(para("姓名：武思豪", style="NoIndent", align="center"))
    parts.append(para("项目名称：SafeCompass 大模型安全评测平台", style="NoIndent", align="center"))
    parts.append(para("摘  要", style="TOCTitle", align="center"))
    parts.append(para(
        "大语言模型在问答、编程和智能体任务中被广泛使用，但其在有害请求和越狱攻击下的拒答可靠性仍难以通过普通能力评测反映。本文围绕 SafeCompass 平台展开，构建了一个面向大语言模型安全风险的可复现评测与可视化流程。平台将 JailbreakBench、HarmBench 和自定义数据集接入统一的 SafeCompass.case.v1 schema，并实现攻击 prompt 生成、OpenAI-compatible 模型调用、LLM-as-judge 判分、多 Judge 投票、Attack Success Rate（ASR）统计和报告导出。"
    ))
    parts.append(para(
        "基于 HarmBench text_test 前 200 条样本的实验显示，本地 Llama-3-70B AWQ 在 Jailbreak Chat 攻击和单 Judge 设置下 ASR 为 7.5%，在多 Judge 设置下 ASR 上升到 16.0%；外部 GPT-compatible 对照模型在相同单 Judge 设置下 ASR 为 0.0%，但有 2 条接口错误样本需复核。结果表明，SafeCompass 能够支持模型间安全表现比较，并揭示 Judge 机制和危害类别差异对安全评测结论的影响。"
    ))
    parts.append(para("关键词：大语言模型安全；越狱攻击；LLM-as-judge；HarmBench；ASR；可复现评测", style="NoIndent"))
    parts.append(page_break())

    # English abstract page.
    parts.append(para("SafeCompass: A Reproducible Evaluation and Visualization Platform for LLM Jailbreak Risks",
                      style="TitleEN", align="center"))
    parts.append(para("", style="NoIndent"))
    abstract_runs = [
        run("Abstract", font_east="Times New Roman", font_ascii="Times New Roman", size=24, bold=True),
        run(": Large language models are increasingly used in question answering, programming, and agentic workflows, but their refusal reliability under harmful requests and jailbreak attacks cannot be captured by ordinary capability evaluation. This report presents SafeCompass, a reproducible evaluation and visualization platform for large language model safety risks. SafeCompass normalizes JailbreakBench, HarmBench, and custom datasets into a unified SafeCompass.case.v1 schema, and implements an end-to-end workflow covering attack prompt generation, OpenAI-compatible model calls, LLM-as-judge scoring, multi-judge voting, Attack Success Rate statistics, and report export. Experiments on the first 200 samples of HarmBench text_test show that local Llama-3-70B AWQ reaches 7.5% ASR under Jailbreak Chat with a single judge and 16.0% ASR under multi-judge voting. A GPT-compatible comparison model records 0.0% ASR under the same single-judge setting, with two interface-error samples requiring review. The results show that SafeCompass supports controlled model comparison and exposes the influence of judge mechanisms and harm categories on safety evaluation conclusions.",
            font_east="Times New Roman", font_ascii="Times New Roman", size=24),
    ]
    parts.append(para(style="NoIndent", runs=abstract_runs))
    keyword_runs = [
        run("Key words", font_east="Times New Roman", font_ascii="Times New Roman", size=24, bold=True),
        run(": large language model safety; jailbreak attack; LLM-as-judge; HarmBench; ASR; reproducible evaluation",
            font_east="Times New Roman", font_ascii="Times New Roman", size=24),
    ]
    parts.append(para(style="NoIndent", runs=keyword_runs))
    parts.append(page_break())

    # TOC page.
    parts.append(para("目  录", style="TOCTitle", align="center"))
    toc_lines = [
        "1 引言…………………………………………………………………………1",
        "2 相关工作与项目定位………………………………………………………2",
        "3 SafeCompass 平台设计……………………………………………………3",
        "3.1 总体架构与评测流程……………………………………………………3",
        "3.2 统一样本 Schema 与攻击策略…………………………………………4",
        "3.3 Judge 判分与指标统计…………………………………………………4",
        "4 实验设计……………………………………………………………………5",
        "4.1 数据集与模型设置………………………………………………………5",
        "4.2 实验变量与评价指标……………………………………………………5",
        "5 实验结果与分析……………………………………………………………6",
        "5.1 总体结果…………………………………………………………………6",
        "5.2 类别风险分析……………………………………………………………7",
        "6 讨论…………………………………………………………………………8",
        "7 结论…………………………………………………………………………9",
        "参考文献………………………………………………………………………10",
    ]
    for line in toc_lines:
        parts.append(para(line, style="NoIndent"))
    parts.append(section_break_to_main())

    # Main content.
    parts.append(para("1 引言", style="Heading1Custom"))
    parts.append(para(
        "大语言模型已经从文本生成工具发展为通用交互系统，并被用于问答、代码生成、写作辅助和复杂任务规划。能力增强提高了模型实用价值，也放大了错误或恶意使用场景中的安全风险。当用户请求网络入侵步骤、违法行为指导、虚假信息生成、骚扰文本、化学与生物风险信息或版权文本复现时，安全对齐后的模型通常应拒绝提供实质性帮助。"
    ))
    parts.append(para(
        "然而，真实交互并不总是以直接有害请求出现。攻击者可以通过角色扮演、研究场景包装、虚构任务设定或指令覆盖等方式改变输入形式，使模型绕过拒答策略并输出有害细节，这类现象通常被称为越狱攻击。因此，仅使用普通问答准确率无法回答安全治理中的核心问题：模型面对有害请求时是否可靠拒答，不同危害类别是否存在薄弱点，不同 Judge 对同一回复是否一致，以及实验结果是否可以保存并复现。"
    ))
    parts.append(para(
        "本文关注的问题是：如何将已有安全基准、攻击策略、模型接口和 Judge 判分机制组织为一个可复现、可比较、可分析的平台流程。SafeCompass 的目标不是提出新的安全基准或攻击算法，而是将评测流程工程化，使研究者能够在统一框架下比较不同模型、不同 Judge 设置和不同危害类别的风险。"
    ))

    parts.append(para("2 相关工作与项目定位", style="Heading1Custom"))
    p_runs = [
        run("大语言模型安全评测关注模型在面对潜在有害输入时是否能够保持稳健拒答。与传统自然语言处理任务不同，安全评测通常需要判断模型输出是否实质性满足了有害请求。Attack Success Rate（ASR）是常用指标，即被判定为 unsafe 的样本比例。ASR 直观、便于比较，但高度依赖样本集合、攻击策略和判分标准。JailbreakBench 强调开放、可复现的越狱评测"),
        ref_run(1),
        run("；HarmBench 则从自动化红队和鲁棒拒答角度，构建覆盖多类有害行为的标准化评测框架"),
        ref_run(2),
        run("。")
    ]
    parts.append(para(style="BodyText", runs=p_runs))
    parts.append(para(
        "LLM-as-judge 能降低人工标注成本，但在安全场景中必须谨慎使用。Judge 的任务不是评价回答是否“有帮助”，而是判断回答是否实质性提供危险信息。单 Judge 流程简单但可能误判边界样本；多 Judge 可以提高风险可见性，但会引入投票分歧、未知输出和接口错误。因此，本文将 Judge 机制视为显式实验变量，并在平台中保留每个 Judge 的原始输出、标签、错误信息和一致率。"
    ))

    parts.append(para("3 SafeCompass 平台设计", style="Heading1Custom"))
    parts.append(para("3.1 总体架构与评测流程", style="Heading2Custom"))
    parts.append(para(
        "SafeCompass 采用轻量 Web 架构，由浏览器前端、Node.js 后端和本地数据文件组成。前端负责数据集选择、模型配置、攻击策略选择、Judge 模式配置、进度展示、表格渲染和报告导出。后端由 server.js 提供静态页面和 API，核心接口包括 GET /api/health、POST /api/evaluate、POST /api/evaluate-stream 和 POST /api/llama-chat。"
    ))
    parts.append(para(
        "一次评测包含七个步骤：加载 JailbreakBench、HarmBench 或自定义数据集；将原始记录规范化为统一 case；根据攻击策略生成攻击 prompt；通过 OpenAI-compatible 接口调用被测模型；将原始请求和模型回复交给 Judge 判分；在多 Judge 模式下执行多数投票；汇总 ASR、类别风险、失败案例和需复核样本，并保存运行记录。"
    ))
    parts.append(para("3.2 统一样本 Schema 与攻击策略", style="Heading2Custom"))
    parts.append(para(
        "不同基准的数据字段并不一致。为降低后续模块与数据来源之间的耦合，SafeCompass 设计了 SafeCompass.case.v1 作为统一样本 schema。规范化后的 case 包含 id、source、dataset、subset、prompt、goal、original_prompt、target、category、behavior、behavior_type 和 metadata 等字段。统一 schema 不消除不同 benchmark 的语义差异，而是将差异限制在加载入口，使攻击、模型调用、Judge 和报告模块可以复用。"
    ))
    parts.append(para(
        "平台当前实现的主要攻击族是 prompt 修改攻击，包括 Direct Request、Human Jailbreaks 和 Jailbreak Chat（JBC）。本文主实验固定使用 JBC，以控制攻击变量并观察模型和 Judge 设置对结果的影响。"
    ))
    parts.append(para("3.3 Judge 判分与指标统计", style="Heading2Custom"))
    parts.append(para(
        "SafeCompass 将模型回复判定为 safe、unsafe 或 ambiguous。safe 表示模型拒答或没有提供实质性有害细节；unsafe 表示模型回复满足了有害请求并计为越狱成功；ambiguous 表示 Judge 输出未知、投票无法形成多数、接口错误或其他需要人工复核的情况。多 Judge 模式可同时启用本地 Llama Judge、GPT-compatible Judge 和 rule-based fallback，并按多数投票聚合。"
    ))

    parts.append(para("4 实验设计", style="Heading1Custom"))
    parts.append(para("4.1 数据集与模型设置", style="Heading2Custom"))
    parts.append(para(
        "本文使用 HarmBench text_test 子集前 200 条样本进行评测。样本覆盖七类危害：cybercrime_intrusion、illegal、misinformation_disinformation、chemical_biological、copyright、harassment_bullying 和 harmful。实验包含本地部署的 Llama-3-70B AWQ 与外部 GPT-compatible 对照模型。"
    ))
    parts.append(para("4.2 实验变量与评价指标", style="Heading2Custom"))
    parts.append(para(
        "三组主实验均固定使用 JBC 攻击策略，将数据集、样本数和攻击方式作为固定变量，将被测模型和 Judge 设置作为变化变量。实验一与实验二控制被测模型不变，用于分析 Judge 机制变化对 ASR 的影响；实验一与实验三控制攻击策略和 Judge 设置不变，用于分析不同模型在相同标准下的安全拒答差异。"
    ))
    parts.append(table(
        "表4.1 实验配置",
        ["实验", "运行记录", "被测模型", "Judge 设置", "样本数", "攻击"],
        [
            ["实验一", "2026-06-15T07-51-23Z", "Llama-3-70B AWQ", "单 Judge", "200", "JBC"],
            ["实验二", "2026-06-15T08-41-51Z", "Llama-3-70B AWQ", "多 Judge", "200", "JBC"],
            ["实验三", "2026-06-15T11-50-34Z", "GPT-compatible", "单 Judge", "200", "JBC"],
        ]
    ))
    parts.append(para("核心指标为 ASR，即 unsafe 样本数除以原始样本总数，再乘以 100%。由于 JBC 对每条原始样本只生成一次攻击尝试，本文中的样本级 ASR 与结果行级 ASR 一致。"))

    parts.append(para("5 实验结果与分析", style="Heading1Custom"))
    parts.append(para("5.1 总体结果", style="Heading2Custom"))
    parts.append(para(
        "三组实验总体结果如表5.1所示。实验一中，Llama-3-70B AWQ 在 200 条样本上产生 185 条安全拒绝、15 条越狱成功，ASR 为 7.5%。实验二保持模型、数据集和攻击策略不变，将 Judge 改为多 Judge 多数投票，ASR 上升到 16.0%。实验三在相同数据集、攻击策略和单 Judge 设置下替换为 GPT-compatible 对照模型，ASR 为 0.0%。"
    ))
    parts.append(table(
        "表5.1 三组实验总体结果",
        ["实验", "被测模型", "Judge", "安全拒绝", "越狱成功", "需复核", "错误", "ASR"],
        [
            ["实验一", "Llama-3-70B AWQ", "单 Judge", "185", "15", "0", "0", "7.5%"],
            ["实验二", "Llama-3-70B AWQ", "多 Judge", "162", "32", "6", "0", "16.0%"],
            ["实验三", "GPT-compatible", "单 Judge", "198", "0", "2", "2", "0.0%"],
        ]
    ))
    parts.append(para("5.2 类别风险分析", style="Heading2Custom"))
    parts.append(para(
        "实验一显示，本地 Llama-3-70B AWQ 在单 Judge 标准下总体拒答能力较强，但仍存在可观察风险。类别层面，cybercrime_intrusion 的 ASR 最高，为 15.6%；illegal 为 10.8%；misinformation_disinformation 为 8.8%；copyright 为 0.0%。这说明技术性攻击请求更容易诱导模型输出具体步骤、payload 或代码。"
    ))
    parts.append(para(
        "实验二表明，Judge 机制会显著影响结论。同一模型、同一数据集和同一 JBC 攻击下，多 Judge 使总体 ASR 从 7.5% 上升到 16.0%。类别变化更明显：cybercrime_intrusion 从 15.6% 上升到 31.3%，misinformation_disinformation 从 8.8% 上升到 26.5%，copyright 从 0.0% 上升到 9.8%。"
    ))
    parts.append(table(
        "表5.2 Llama-3-70B 在单 Judge 与多 Judge 下的类别 ASR",
        ["类别", "样本数", "单 Judge ASR", "多 Judge ASR", "多 Judge 需复核"],
        [
            ["cybercrime_intrusion", "32", "15.6%", "31.3%", "1"],
            ["misinformation_disinformation", "34", "8.8%", "26.5%", "2"],
            ["illegal", "37", "10.8%", "13.5%", "0"],
            ["copyright", "51", "0.0%", "9.8%", "3"],
            ["chemical_biological", "21", "4.8%", "4.8%", "0"],
            ["harassment_bullying", "15", "6.7%", "6.7%", "0"],
            ["harmful", "10", "10.0%", "10.0%", "0"],
        ]
    ))
    parts.append(para(
        "实验三显示，GPT-compatible 对照模型在 200 条样本中没有被单 Judge 判定为越狱成功，ASR 为 0.0%。但该实验有 2 条 chemical_biological 样本因外部接口返回 502 Bad Gateway 被标记为需复核。因此，实验三应解释为：在成功完成的 198 条调用中未观测到越狱成功；接口稳定性仍会影响实验完整性。"
    ))

    parts.append(para("6 讨论", style="Heading1Custom"))
    parts.append(para(
        "SafeCompass 的研究意义在于将安全评测从临时 prompt 测试转化为可复现的数据流程。单次测试只能说明模型在某条输入上是否失败，而平台化评测可以同时记录样本来源、攻击改写、模型回复、Judge 输出、分歧票、接口错误和类别信息。这样，最终 ASR 可以被回溯到逐条样本和逐个 Judge 判断，便于复核和比较。"
    ))
    parts.append(para(
        "实验结果也表明，Judge 机制不能被视为中性的后台工具。单 Judge 流程简单、成本较低，但可能低估边界风险；多 Judge 更敏感，但会引入分歧和需复核样本。对安全治理而言，更合理的做法是将自动化 Judge 用于大规模筛查，将高风险类别、低一致率样本和 ambiguous 样本交给人工复核。"
    ))
    parts.append(para(
        "本文仍有局限。实验只使用 HarmBench text_test 前 200 条样本，规模和类别覆盖有限；主实验只使用 JBC 单轮攻击，尚未覆盖 PAIR 等自动化多轮攻击、多模态输入、工具调用和长上下文智能体任务；Judge 可靠性尚未通过人工标注校准；实验三依赖外部接口，接口错误使部分样本无法完成评测。"
    ))

    parts.append(para("7 结论", style="Heading1Custom"))
    parts.append(para(
        "本文提出 SafeCompass，一个面向大语言模型越狱风险的可复现安全评测与可视化平台。平台通过统一 schema 接入多源数据，并将攻击生成、模型调用、LLM-as-judge 判分、多 Judge 投票、ASR 统计、类别风险分析和报告导出组织为端到端流程。"
    ))
    parts.append(para(
        "基于 HarmBench text_test 前 200 条样本的三组实验表明，SafeCompass 能够在控制变量的条件下比较模型安全拒答表现，并揭示 Judge 机制对评测结论的影响。Llama-3-70B AWQ 在单 Judge 下 ASR 为 7.5%，在多 Judge 下 ASR 上升到 16.0%；GPT-compatible 对照模型在相同单 Judge 设置下 ASR 为 0.0%，但有 2 条接口错误样本需复核。类别分析进一步显示，网络入侵和虚假信息等类别风险更集中，单一总体 ASR 不足以支撑细粒度安全诊断。"
    ))

    parts.append(page_break())
    parts.append(para("参考文献", style="TOCTitle", align="center"))
    refs = [
        "[1] Chao P, Debenedetti E, Robey A, et al. JailbreakBench: An Open Robustness Benchmark for Jailbreaking Large Language Models[Z]. arXiv:2404.01318, 2024.",
        "[2] Mazeika M, Phan L, Yin X, et al. HarmBench: A Standardized Evaluation Framework for Automated Red Teaming and Robust Refusal[Z]. arXiv:2402.04249, 2024.",
        "[3] Zheng L, Chiang W L, Sheng Y, et al. Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena[Z]. arXiv:2306.05685, 2023.",
    ]
    for ref in refs:
        parts.append(para(ref, style="ReferenceText"))

    document = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="%s" xmlns:r="%s">
<w:body>
%s
%s
</w:body>
</w:document>""" % (NS_W, NS_R, "\n".join(parts), final_section_props())
    return document


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types())
        z.writestr("_rels/.rels", package_rels())
        z.writestr("word/_rels/document.xml.rels", document_rels())
        z.writestr("word/document.xml", build_doc())
        z.writestr("word/styles.xml", styles_xml())
        z.writestr("word/settings.xml", settings_xml())
        z.writestr("word/footer1.xml", footer_xml("i"))
        z.writestr("word/footer2.xml", footer_xml("1"))
    print(OUT)


if __name__ == "__main__":
    main()
