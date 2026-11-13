-- The Chinese display name is Guanlan; the English brand remains VaultView.
UPDATE Content
SET title = replace(title, 'Guanlan', 'VaultView'),
    description = replace(description, 'Guanlan', 'VaultView')
WHERE instr(title, 'Guanlan') > 0 OR instr(description, 'Guanlan') > 0;

UPDATE LiteraryWriter
SET data = replace(data, 'Guanlan', 'VaultView')
WHERE instr(data, 'Guanlan') > 0;
