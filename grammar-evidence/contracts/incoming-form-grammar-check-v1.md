# Checking incoming source forms against Grammar Graph

Status: interface proposal, informed by read-only R100 comparison; runtime integration OPEN.

For a newly received form, retain lexeme/article identity, source, form key, alternatives and the exact observed surface. A source-confirmed lexeme/POS may be accepted as an input fact for form validation. In sentence analysis, source POS remains a candidate until grammatical context resolves it.

The graph evaluates applicable rule conditions and derives its expected form **before** reading the observed target form. It then compares the derived result with all source-supported primary and alternative forms for that same lexeme/article. A target observation must never select a rule or rewrite the derivation.

Return one of: `consistent_with_rule`, `source_diverges`, `rule_not_applicable`, `insufficient_rule_features`, `uncovered_form_class`, or `ambiguous_rule`. Keep both the source observation and graph derivation with provenance. `source_diverges` is a review signal, not automatic rejection of a verified source: irregular forms, lexical exceptions and two-step operations require their own rules and tests.

R100's 136 adjective common/comparative pairs demonstrate the method. It is not yet a normal runtime path. To ship it, prove rule eligibility independent of target lookup, cover exception and composition families, and test that the comparison never changes POS or lexeme identity by itself.
