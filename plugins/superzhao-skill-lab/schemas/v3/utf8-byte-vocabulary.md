# UTF-8 byte assertion vocabulary v1

Vocabulary URI: `https://superzhao.dev/schemas/skill-lab/v3/vocab/utf8-bytes/v1`

`x-maxUtf8Bytes` is an assertion keyword whose value is a non-negative integer.
For a string instance, validation succeeds only when the instance's UTF-8 encoding
contains no more than that many UTF-8 bytes. It has no effect on non-string instances.

The Skill Lab v3 meta-schema declares this as a required vocabulary. A validator
that does not implement the vocabulary must refuse the dialect as unsupported; it
must not silently ignore `x-maxUtf8Bytes` or treat it only as an annotation.
