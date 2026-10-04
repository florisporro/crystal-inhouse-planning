-- trigram: substring matching, works for Dutch compounds ("stalling" finds "fietsenstalling")
CREATE VIRTUAL TABLE `wiki_search` USING fts5(page_id UNINDEXED, title, public_text, private_text, tokenize='trigram');
