#! /usr/bin/osascript

set imessageBuddies to {}
set imessageBuddyJson to {}
set errorMessages to {}

tell application "Messages"
  if not running then run

  repeat with theBuddy in (get every buddy)
    try
      set serviceType to service type of service of theBuddy
      if (serviceType as string) is equal to "iMessage" then
        set buddyRecord to {|handle|: (handle of theBuddy), |name|: (name of theBuddy), |id|: (id of theBuddy)}
        copy buddyRecord to the end of imessageBuddies
      end if

    on error errorMessage
      #log errorMessage
      set errorMessages to errorMessages & errorMessage
    end try
  end repeat
end tell

try
  repeat with theBuddy in imessageBuddies
    set buddyHandle to |handle| of theBuddy
    set buddyPerson to getContact((|name| of theBuddy), buddyHandle)

    if buddyPerson is not equal to missing value then
      set jsonBuddy to my createDictWith({ {"imessageId", id of buddyPerson}, {"name", name of buddyPerson}, {"handle", buddyHandle} })
    else
      set jsonBuddy to my createDictWith({ {"imessageId", |id| of theBuddy}, {"name", |name| of theBuddy}, {"handle", buddyHandle} })
      set errorMessages to errorMessages & ("Contact Person not found for Buddy " & buddyHandle)
    end if

    set imessageBuddyJson to imessageBuddyJson & jsonBuddy
  end repeat

on error errorMessage
  set errorMessages to errorMessages & errorMessage
end try

set imessageBuddyJson to my createDictWith({ {"buddies", imessageBuddyJson}, {"errors", errorMessages} })

log my encode(imessageBuddyJson)

# duplicate code in Liberator.applescript because AppleScript sucks
on getContact(theFullName, theHandle)
  set buddyPerson to missing value

  tell application "Contacts"
    if not running then run

    set personList to (people whose name is theFullName)

    if (count of personList) is greater than 0 then
      repeat with thePerson in personList
        if value of phones of thePerson contains theHandle then
          set buddyPerson to thePerson
          exit repeat
        end if
      end repeat

      if buddyPerson is equal to missing value then
        repeat with thePerson in personList
          if value of emails of thePerson contains theHandle then
            set buddyPerson to thePerson
            exit repeat
          end if
        end repeat
      end if

      if buddyPerson is equal to missing value then
        set buddyPerson to (first item in personList)
      end if
    end if
  end tell

  return buddyPerson
end

# JSON encoding copied from https://github.com/mgax/applescript-json

on encode(value)
  set type to class of value
  if type = integer or type = boolean
    return value as text
  else if type = text
    return encodeString(value)
  else if type = list
    return encodeList(value)
  else if type = script
    return value's toJson()
  else
    error "Unknown type " & type
  end
end


on encodeList(value_list)
  set out_list to {}
  repeat with value in value_list
    copy encode(value) to end of out_list
  end
  return "[" & join(out_list, ", ") & "]"
end


on encodeString(value)
  set rv to ""
  repeat with ch in value
    if id of ch = 34
      set quoted_ch to "\\\""
    else if id of ch = 92 then
      set quoted_ch to "\\\\"
    else if id of ch >= 32 and id of ch < 127
      set quoted_ch to ch
    else
      set quoted_ch to "\\u" & hex4(id of ch)
    end
    set rv to rv & quoted_ch
  end
  return "\"" & rv & "\""
end


on join(value_list, delimiter)
  set original_delimiter to AppleScript's text item delimiters
  set AppleScript's text item delimiters to delimiter
  set rv to value_list as text
  set AppleScript's text item delimiters to original_delimiter
  return rv
end


on hex4(n)
  set digit_list to "0123456789abcdef"
  set rv to ""
  repeat until length of rv = 4
    set digit to (n mod 16)
    set n to (n - digit) / 16 as integer
    set rv to (character (1+digit) of digit_list) & rv
  end
  return rv
end


on createDictWith(item_pairs)
  set item_list to {}

  script Dict
    on setkv(key, value)
      copy {key, value} to end of item_list
    end

    on toJson()
      set item_strings to {}
      repeat with kv in item_list
        set key_str to encodeString(item 1 of kv)
        set value_str to encode(item 2 of kv)
        copy key_str & ": " & value_str to end of item_strings
      end
      return "{" & join(item_strings, ", ") & "}"
    end
  end

  repeat with pair in item_pairs
    Dict's setkv(item 1 of pair, item 2 of pair)
  end

  return Dict
end


on createDict()
  return createDictWith({})
end
