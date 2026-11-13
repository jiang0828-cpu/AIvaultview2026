-- Keep document IDs, hierarchy and timestamps intact when updating the display brand.
UPDATE Content
SET title = replace(replace(title, '藏览', '观澜'), 'VaultView', 'Guanlan'),
    description = replace(replace(description, '藏览', '观澜'), 'VaultView', 'Guanlan')
WHERE instr(title, '藏览') > 0 OR instr(title, 'VaultView') > 0
   OR instr(description, '藏览') > 0 OR instr(description, 'VaultView') > 0;

UPDATE LiteraryWriter
SET data = replace(replace(data, '藏览', '观澜'), 'VaultView', 'Guanlan')
WHERE instr(data, '藏览') > 0 OR instr(data, 'VaultView') > 0;
