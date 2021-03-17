# ApexIntelliSense README

AutoCompletion aka IntelliSense for APEX parsing schemas, inclusive all granted packages, procedures and functions. 
Access to APEX page items.

## Requirements
- You must perform an ApexIntelliSense->activate (to establish a Database Connection)
- You must connect to the Development Environment
- You must download and install the OracleInstantClient 
- You must configure the Plugin under Settings->ApexIntelliSense

## Extension Settings

This extension contributes the following settings:

* `ApexIntelliSense.Connection`: connection string to database
* `ApexIntelliSense.Username`: schema name
* `ApexIntelliSense.Oracle Instant Client Path`: Path to your Oracle Instant Client
* `ApexIntelliSense.PublicPackages`: Comma (",")-seperated list of packages that are granted to public and exposed via public synonym 
* `ApexIntelliSense.LoadApexPacakges`: Wether the APEX_* Packages should be loaded (see 'Feature->Caching' in this readme)
* `ApexIntelliSense.LoadObjectsOnActivate`: Wether DB Objects should be loaded when extension is activated, otherwise it tries to load objects from cache
* `ApexIntelliSense.ApexCacheFile`: Load a central apex-Cache File to the Extension instead of pulling it again

## Features

### Caching
When the plugin is activated it will create a directory .ais where caches are stored.
There are two types of caches:

- User Object Cache (cache.yaml)
- APEX Object Cache (apex.yaml)

#### User Object Cache

The User Object Cache will contain the following Objects:

- APEX Page Items
- All executable Packages/Procedures/Functions incl. of their arguments and return types

#### APEX Object Cache

The APEX Object Cache contains all APEX_* Packages with all of their methods (and of course arguments and return types) regardless of them to be part of the documentation or not.

## Known Issues

None so far...

## Release Notes


### 1.0.0

Initial release of ApexIntelliSense

### 1.0.1

Fixed Bug wrong arguments in method

### 1.0.2

Integrated Setting, PublicPackages:
Comma (",")-seperated list of packages that are granted to public and exposed via public synonym.
APEX Application Items

### 2.0.0
- Caching
- nicer CompletionItemList with documentation

### 2.0.1
- Additional APEX Cache
- Settings Bug

### 2.0.2
- Connection Bug
- Performance!!

### 2.1.0
- new Setting: ApexCacheFilePath

### 2.2.0
- autocompletion enhancements
    
**Enjoy!**
