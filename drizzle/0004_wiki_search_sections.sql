-- one row per h2/h3 section so results can link to #anchors; the index is rebuilt
-- at boot by ensureSearchIndex() when it is empty
DROP TABLE IF EXISTS `wiki_search`;--> statement-breakpoint
CREATE VIRTUAL TABLE `wiki_search` USING fts5(page_id UNINDEXED, anchor UNINDEXED, title, heading, public_text, private_text, tokenize='trigram');
